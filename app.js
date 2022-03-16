"use strict";

const startTime = Date.now();

const winston = require('winston');
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: {service: 'user-service'},
    transports: [
        // - Write all logs with level `info` and below to `combined.log`
        new winston.transports.File({filename: './jsLog.log', options: {flags: "w"}})
    ],
});

// If we're not in production then log to the `console` with the format: `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env["NODE_ENV"] !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}
Object.freeze(logger);

// Putting it in global object so that it can be accessed from anywhere.
// This practice should be avoided and be used in cases only like this.
global["globalLoggerObject"] = logger;

const open = require('open');
const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const configData = require("./configData.json");
const packageJson = require("./package.json");
const {MongoClient, Collection} = require('mongodb');
const Json2csvParser = require('json2csv').Parser;
const fs = require("fs");
const Moralis = require("moralis/node");
const Web3 = require("web3");

const testMode = configData["testMode"];
let portNumber = process.env["PORT"];
if (!portNumber) {
    portNumber = 6971;
}

const app = express();
const httpServer = http.createServer(app);
const outputFolder = __dirname + "/public";

// Shutdown Handler
const shutdownHandler = (event) => {
    logger.info(`Script Exit command ${event} received. Gracefully closing pending tasks. Please wait...`);
    mongoClient.close().then(() => {
        console.log("Script successfully exited...");
        process.exit();
    }).catch(() => {
        console.log("Error when closing DB connection.");
        process.exit();
    });

    setTimeout(() => {
        logger.info("Shutdown Handler Time Limit Reached");
        process.exit(1);
    }, 25000);
};
process.on("SIGINT", shutdownHandler);
process.on("SIGTERM", shutdownHandler);
process.stdin.resume();

const io = new Server(httpServer);

// --- SERVE NODE MODULES --- //
app.get('/node_modules/*.*', (req, res) => {
    try {
        res.status(200).sendFile(__dirname + req.path);
    } catch {
        res.sendStatus(404);
    }
});
// ---- SERVE STATIC FILES ---- //
app.get('*.*', express.static(outputFolder, {maxAge: 60 * 1000}));
// ---- SERVE APPLICATION PATHS ---- //
app.all('*', function (req, res) {
    res.status(200).sendFile(`/`, {root: outputFolder});
});

const delay = (ms) => new Promise(res => setTimeout(res, ms));
const buildCursorFromList = (sourceList) => {
    const items = sourceList;
    let index = 0;
    const _hasNext = () => {
        return index < items.length;
    };

    return {
        "next": async () => {
            if (_hasNext()) {
                return items[index++];
            } else {
                return null;
            }
        },

        "hasNext": async () => {
            return _hasNext();
        }
    };
};

// const printSaveData = (saveData) => {
//     console.log(JSON.stringify(saveData).replaceAll(/[:,]/gi, (matched) => {
//         switch (matched) {
//             case ":":
//                 return ": ";
//
//             case ",":
//                 return ", ";
//         }
//     }));
// };

let mongoUrl = "mongodb+srv://" + configData["DBUsername"] + ":" + configData["DBPassword"] + "@" +
    configData["DBClusterName"].replace(/[ ]+/g, "").toLowerCase() + ".zm0r5.mongodb.net/" + configData["DBName"];
/** @type MongoClient */
let mongoClient,
    /** @type Collection */
    userCollection;
const connectToDatabase = async () => {
    mongoClient = await MongoClient.connect(mongoUrl);
    userCollection = await mongoClient.db("Polygon-NFT-Data").collection("userData");
};
const web3 = new Web3(configData["moralisSpeedyUrl"]);

let callWeight = 0, callStartTime = 0;
let nextApiCallTime = 0, apiCallCount = 0;
let collectedData = {}, foundContracts = {}, lastCheckedBlock;
const zeroAddress = "0x0000000000000000000000000000000000000000";
const updateDatabase = async () => {
    let updateStartTime = Date.now();

    let keySet = Object.keys(collectedData);
    for (let key of keySet) {
        await userCollection.updateOne({"effectiveAddress": key},
            {
                "$setOnInsert": {
                    "effectiveAddress": key,
                    "hasSentNFT": false,
                    "hasSentERC20": false
                },
                "$max": {"latestBlockNumber": collectedData[key]["latestBlockNumber"]},
                "$inc": {"foundCount": collectedData[key]["foundCount"]}
            },
            {upsert: true});
    }
    collectedData = {};

    let updateEndTime = Date.now();
    console.log("Updated Database in " + (updateEndTime - updateStartTime) + " ms");
};
const preAPICallCheck = async (appendMessage = "") => {
    let currentTime = Date.now();
    if (currentTime < nextApiCallTime) {
        await delay(975);
    }
    nextApiCallTime = currentTime + 1000;

    console.log(`API Call ${++apiCallCount} at ${Date.now()} for ${appendMessage}`);
};
const fetchDataFromMoralis = async (from_block, to_block, chain) => {
    callWeight = 0;
    callStartTime = Date.now();
    let web3 = new Web3(configData["moralisSpeedyUrl"]);
    let cursor;
    let options = {
        chain,
        from_block,
        to_block
    };
    let effectiveAddress = "", operationType,
        previousData = {"operationType": "", "transactionHash": "", "blockNumber": ""};

    do {
        if (cursor) {
            options["cursor"] = cursor;
        }

        let callStartTime = Date.now();
        await preAPICallCheck("getting NFT transfers");
        let nftTransfers = await Moralis.Web3API.token.getNftTransfersFromToBlock(options);
        callWeight += 5;
        cursor = nftTransfers["cursor"];
        let result = nftTransfers["result"];

        let resultCount = result.length;
        if ((nftTransfers["page_size"] * (nftTransfers["page"] + 1)) >= nftTransfers["total"]) {
            break;
        } else {
            console.log(`Received Response from Moralis in ${Date.now() - callStartTime} ms containing ${resultCount} transfers`);
            if (resultCount === 0) {
                break;
            }
        }

        let startTime = Date.now();
        for (let transfer of result) {
            let shouldSave = true;
            if (transfer["from_address"] === zeroAddress) {
                operationType = "Mint";
                shouldSave = false;
            } else if (transfer["to_address"] === zeroAddress) {
                effectiveAddress = transfer["from_address"];
                operationType = "Burn"
            } else {
                effectiveAddress = transfer["from_address"]
                operationType = "Transfer"
            }

            previousData["operationType"] = operationType;
            previousData["transactionHash"] = transfer["transaction_hash"];

            if (shouldSave) {
                if (Web3.utils.isAddress(effectiveAddress)) {
                    effectiveAddress = Web3.utils.toChecksumAddress(effectiveAddress);
                    if (foundContracts[effectiveAddress] == null) {
                        if (transfer["block_number"] !== previousData["blockNumber"]) {
                            console.log("Found NFT transfers in Block : " + transfer["block_number"]);
                        }
                        if (collectedData[effectiveAddress] == null) {
                            let code = await web3.eth.getCode(effectiveAddress);
                            callWeight += 3;
                            await delay(60);
                            if (code === "0x") {
                                collectedData[effectiveAddress] = {
                                    effectiveAddress,
                                    "foundCount": 1,
                                    "latestBlockNumber": parseInt(transfer["block_number"])
                                };
                            } else {
                                foundContracts[effectiveAddress] = true;
                            }
                        } else {
                            collectedData[effectiveAddress]["foundCount"] += 1;
                        }
                    }
                } else {
                    console.log(transfer);
                }
            }

            previousData["blockNumber"] = transfer["block_number"];
            lastCheckedBlock = previousData["blockNumber"];

            if (testMode) {
                break;
            }
        }
        console.log(`Processed all transfers in ${Date.now() - startTime} ms`);
        if (testMode) {
            break;
        }
    } while (cursor)
};
const runFetchDataFunction = async (startBlock, endBlock, chain = "polygon") => {
    // Assert the startBlock >= endBlock
    if (startBlock < endBlock) {
        throw "endBlock cannot be less than the startBlock";
    }
    Moralis.Web3API.initialize({
        serverUrl: configData["moralisServerUrl"],
        apiKey: configData["moralisApiKey"]
    });

    lastCheckedBlock = startBlock.toString();
    let consecutiveErrors = 0;
    for (let currentStartBlock = startBlock; currentStartBlock >= endBlock; currentStartBlock -= 10) {
        let currentEndBlock = currentStartBlock - 9;
        if (currentEndBlock < endBlock) {
            currentEndBlock = endBlock;
        }
        console.log("\n\nFor Loop --> " + currentStartBlock + ", " + currentEndBlock);

        /* The results returned by moralis are from higher block number to smaller block number */
        try {
            await fetchDataFromMoralis(currentEndBlock, currentStartBlock, chain);
            await updateDatabase();
            consecutiveErrors = 0;
        } catch (err) {
            console.log("Error Response from Moralis. Waiting 30 seconds before continuing.");
            console.log(`callWeight: ${callWeight} from ${callStartTime} to ${Date.now()}`);
            currentStartBlock = parseInt(lastCheckedBlock) + 10;
            consecutiveErrors += 1;

            if (consecutiveErrors === 3) {
                console.log("Encountered 3 Consecutive Errors... Exiting Script.");
                console.log(err);
                return;
            } else {
                await delay(30000);
            }
        }

        if (testMode) {
            break;
        }
    }
};

const databaseToExcel = async (outputFilename) => {
    let allDocuments = await userCollection.find({}).sort({"latestBlockNumber": -1}).allowDiskUse().toArray();
    const json2csvParser = new Json2csvParser({header: true});
    if (allDocuments.length > 0) {
        const csvData = json2csvParser.parse(allDocuments);
        fs.writeFile("./" + outputFilename, csvData, function (err) {
            if (err) {
                throw err;
            }
        });
    } else {
        throw "No users present in the database";
    }
};

let sendTransactionCount = 0, consecutiveFailure = 0;
const updateGasPrice = async (baseTransaction, gasScaling = 140) => {
    if (sendTransactionCount === 0) {
        baseTransaction["gasPrice"] = ((BigInt(await web3.eth.getGasPrice()) * BigInt(gasScaling)) / 100n).toString();
        sendTransactionCount = 1;
    } else {
        sendTransactionCount += 1;
        sendTransactionCount %= 5;
    }
};
const sendTransactionToBlockchain = async (baseTransaction, senderPK, smartContract, functionName, params, sendItemName, errorTolerance) => {
    let returnResult;
    try {
        let execFunction = smartContract.methods[functionName];
        baseTransaction["data"] = (typeof params === "object") ? execFunction(...params).encodeABI() : execFunction(params).encodeABI();
        let signedTransaction = await web3.eth.accounts.signTransaction(baseTransaction, senderPK);
        let trxStartTime = Date.now();
        console.log("Dispatched a pending transaction with hash: " + signedTransaction.transactionHash + " to blockchain. Awaiting confirmation.");
        let transactionReceipt = await web3.eth.sendSignedTransaction(signedTransaction.rawTransaction);
        if (transactionReceipt.status) {
            let trxEndTime = Date.now();
            console.log(sendItemName + " batch transfer complete in " + (trxEndTime - trxStartTime) +
                " ms. Trx. Hash : " + transactionReceipt.transactionHash + ".");
            consecutiveFailure = 0;
        } else {
            console.log("Trx. Error : ");
            consecutiveFailure += 1;
            console.log(transactionReceipt);
        }
        returnResult = transactionReceipt.status;
    } catch (err) {
        console.log("Error when sending " + sendItemName + ". Trx. failed.");
        console.log(err);
        consecutiveFailure += 1;
        returnResult = false;
    }
    if (consecutiveFailure >= errorTolerance) {
        consecutiveFailure = 0;
        throw "Encountered at least " + errorTolerance + " consecutive send transaction failures. Terminating the operation";
    }
    await delay(7000);
    return returnResult;
};

let currentTokenIdIndex = -1, maxAddressPerNFTSend = configData["maxAddressPerNFTSend"];
const getTokenId = (tokenIdList) => {
    currentTokenIdIndex++;
    return tokenIdList[currentTokenIdIndex];
};
const runSendNFTFunction = async (initParams) => {
    const baseTransaction = {
        "chainId": await web3.eth.getChainId(),
        "from": initParams["senderWalletAddress"],
        "to": configData["sendNFTContractAddress"],
        "value": 0,
        "gas": configData["sendNFTGasLimit"],
        "gasPrice": 0
    };
    const nftSenderContract = new web3.eth.Contract(configData["sendNFTContractABI"], configData["sendNFTContractAddress"]);

    let findDocument = {"latestBlockNumber": {}}, didSetNFTBlockNumber = false;
    if (initParams["sendUpperBlockLimit"]) {
        findDocument["latestBlockNumber"]["$lte"] = parseInt(initParams["sendUpperBlockLimit"]);
        didSetNFTBlockNumber = true;
    }
    if (initParams["sendLowerBlockLimit"]) {
        findDocument["latestBlockNumber"]["$gte"] = parseInt(initParams["sendLowerBlockLimit"]);
        didSetNFTBlockNumber = true;
    }
    if (!didSetNFTBlockNumber) {
        delete findDocument["latestBlockNumber"];
    }

    let documentWithUnsentNFT,
        customAddressMode = initParams["useCustomAddressList"] && initParams["customAddressList"];
    if (customAddressMode) {
        documentWithUnsentNFT = buildCursorFromList(initParams["customAddressList"]);
        console.log("Detected custom address list. Using custom address list instead of database.");
    } else {
        documentWithUnsentNFT = await userCollection
            .find(findDocument)
            .sort({"latestBlockNumber": -1})
            .allowDiskUse();
        console.log("Fetching data from database.");
    }

    let sendFunctionParamCount = initParams["sendFunctionParamCount"];

    let hasMoreTokenIdsToSend = true;
    let recipientAddresses = [], tokenIdList = [];
    while (true) {
        if (hasMoreTokenIdsToSend) {
            if (await documentWithUnsentNFT.hasNext()) {
                if (recipientAddresses.length < maxAddressPerNFTSend) {
                    let currentTokenId = getTokenId(initParams["tokenIdList"]);
                    if (currentTokenId) {
                        tokenIdList.push(currentTokenId);
                        let currentDocument = await documentWithUnsentNFT.next();
                        if (customAddressMode) {
                            recipientAddresses.push(currentDocument);
                        } else {
                            recipientAddresses.push(currentDocument["effectiveAddress"]);
                        }
                    } else {
                        hasMoreTokenIdsToSend = false;
                    }
                    continue;
                } else {
                    console.log("Generated current list of users " + ((customAddressMode) ? "." : " from addresses in database."));
                }
            } else if (recipientAddresses.length === 0) {
                break;
            }
        } else if (recipientAddresses.length === 0) {
            console.log("Operation Complete");
            break;
        }
        await updateGasPrice(baseTransaction, initParams["gasScaling"]);

        let contractParams;
        switch (sendFunctionParamCount) {
            case 4:
            case "4":
                contractParams = [
                    initParams["nftContractAddress"],
                    initParams["senderWalletAddress"],
                    recipientAddresses,
                    tokenIdList
                ];
                break;

            case 5:
            case "5":
                contractParams = [
                    initParams["nftContractAddress"],
                    initParams["senderWalletAddress"],
                    recipientAddresses,
                    tokenIdList,
                    1
                ];
                break;
        }

        let success = await sendTransactionToBlockchain({...baseTransaction}, initParams["senderPrivateKey"],
            nftSenderContract, configData["sendNFTFunctionName"][sendFunctionParamCount], contractParams, "NFT", 3);

        if (success && !customAddressMode) {
            console.log("Updating database.");
            for (let address of recipientAddresses) {
                await userCollection.updateOne({"effectiveAddress": address}, {"$set": {"hasSentNFT": true}});
            }
            console.log("Database Updated.");
        }
        if (testMode) {
            break;
        }
        recipientAddresses = [];
        tokenIdList = [];
    }
};

const maxAddressPerERC20Send = configData["maxAddressPerERC20Send"];
const runSendERC20Function = async (initParams) => {
    const baseTransaction = {
        "chainId": await web3.eth.getChainId(),
        "from": initParams["senderWalletAddress"],
        "to": configData["sendERC20ContractAddress"],
        "value": 0,
        "gas": configData["sendERC20GasLimit"],
        "gasPrice": 0
    };
    const erc20SenderContract = new web3.eth.Contract(configData["sendERC20ContractABI"], configData["sendERC20ContractAddress"]);

    let findDocument = {"latestBlockNumber": {}}, didSetERC20BlockNumber = false;
    if (initParams["sendUpperBlockLimit"]) {
        findDocument["latestBlockNumber"]["$lte"] = parseInt(initParams["sendUpperBlockLimit"]);
        didSetERC20BlockNumber = true;
    }
    if (initParams["sendLowerBlockLimit"]) {
        findDocument["latestBlockNumber"]["$gte"] = parseInt(initParams["sendLowerBlockLimit"]);
        didSetERC20BlockNumber = true;
    }
    if (!didSetERC20BlockNumber) {
        delete findDocument["latestBlockNumber"];
    }

    let documentWithUnsentERC20,
        customAddressMode = initParams["useCustomAddressList"] && initParams["customAddressList"];
    if (customAddressMode) {
        documentWithUnsentERC20 = buildCursorFromList(initParams["customAddressList"]);
        console.log("Detected custom address list. Using custom address list instead of database.");
    } else {
        documentWithUnsentERC20 = await userCollection
            .find(findDocument)
            .sort({"latestBlockNumber": -1})
            .allowDiskUse();
        console.log("Fetching data from database.");
    }

    let recipientAddresses = [];
    while (true) {
        if (await documentWithUnsentERC20.hasNext()) {
            if (recipientAddresses.length < maxAddressPerERC20Send) {
                let currentDocument = await documentWithUnsentERC20.next();
                if (customAddressMode) {
                    recipientAddresses.push(currentDocument);
                } else {
                    recipientAddresses.push(currentDocument["effectiveAddress"]);
                }
                continue;
            } else {
                console.log("Generated current list of users " + ((customAddressMode) ? "." : " from addresses in database."));
            }
        } else if (recipientAddresses.length === 0) {
            console.log("Operation Complete.");
            break;
        }
        await updateGasPrice(baseTransaction, initParams["gasScaling"]);

        let contractParams = [
            initParams["erc20TokenAddress"], recipientAddresses, Array(recipientAddresses.length).fill(initParams["transferAmount"])
        ];
        let success = await sendTransactionToBlockchain({...baseTransaction}, initParams["senderPrivateKey"],
            erc20SenderContract, configData["sendERC20FunctionName"], contractParams, "ERC20", 3);

        if (success && !customAddressMode) {
            console.log("Updating database.");
            for (let address of recipientAddresses) {
                await userCollection.updateOne({"effectiveAddress": address}, {"$set": {"hasSentERC20": true}});
            }
            console.log("Database Updated.");
        }
        if (testMode) {
            break;
        }
        recipientAddresses = [];
    }
};

let isExecutingOperation = false;
io.on('connection', (socket) => {
    socket.on('getSoftwareVersion', () => {
        socket.emit('setSoftwareVersion', packageJson["version"]);
    });

    socket.on('fetchPolygonNFTUsers', async (blockData) => {
        console.log("Server received request for parsing blockchain.");
        if (isExecutingOperation) {
            socket.emit('alreadyExecutingOperation');
        } else {
            console.log("Request Acknowledged");
            isExecutingOperation = true;
            try {
                await runFetchDataFunction(blockData["upperBlockLimit"], blockData["lowerBlockLimit"]);
                socket.emit('fetchPolygonNFTUsersResult', {
                    "success": true
                });
            } catch (err) {
                console.log(err);
                socket.emit('fetchPolygonNFTUsersResult', {
                    "success": false,
                    "error": err
                });
            }
            isExecutingOperation = false;
        }
    });

    socket.on('databaseToExcel', async (data) => {
        if (isExecutingOperation) {
            socket.emit('alreadyExecutingOperation');
        } else {
            isExecutingOperation = true;
            try {
                await databaseToExcel(data["outputFileName"]);
                socket.emit('databaseToExcelResult', {
                    "success": true
                });
            } catch (err) {
                console.log(err);
                socket.emit('databaseToExcelResult', {
                    "success": false,
                    "error": err
                });
            }
            isExecutingOperation = false;
        }
    });

    socket.on('sendNFTsToUsers', async (data) => {
        console.log("Server received request for sending NFTs");
        if (isExecutingOperation) {
            socket.emit('alreadyExecutingOperation');
        } else {
            console.log("Request Acknowledged");
            isExecutingOperation = true;
            try {
                await delay(7000);
                await runSendNFTFunction(data);
                socket.emit('sendNFTsToUsersResult', {
                    "success": true
                });
            } catch (err) {
                console.log(err);
                socket.emit('sendNFTsToUsersResult', {
                    "success": false,
                    "error": err
                });
            }
            isExecutingOperation = false;
        }
        sendTransactionCount = 0;
        currentTokenIdIndex = -1;
    });

    socket.on('sendERC20ToUsers', async (data) => {
        console.log("Server received request for sending ERC20s");
        if (isExecutingOperation) {
            socket.emit('alreadyExecutingOperation');
        } else {
            console.log("Request Acknowledged");
            isExecutingOperation = true;
            try {
                await delay(7000);
                await runSendERC20Function(data);
                socket.emit('sendERC20ToUsersResult', {
                    "success": true
                });
            } catch (err) {
                console.log(err);
                socket.emit('sendERC20ToUsersResult', {
                    "success": false,
                    "error": err
                });
            }
            isExecutingOperation = false;
        }
        sendTransactionCount = 0;
    });
});

connectToDatabase().then(() => {
    const endTime = Date.now();
    logger.info("Initialization Complete in " + (endTime - startTime) / 1000 + " seconds");
    httpServer.listen(portNumber, () => {
        logger.info('Listening on port ' + portNumber);
    });
    open("http://localhost:" + portNumber);
});
