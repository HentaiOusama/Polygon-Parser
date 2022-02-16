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
    logger.info("Shutdown Handler Start for " + event);
    mongoClient.close().then().catch(() => {
        console.log("Error when closing DB connection.");
    });

    setTimeout(() => {
        logger.info("Shutdown Handler End");
        process.exit(1);
    }, 25000);
};
if (process.stdin.isTTY && !process.stdin.isRaw) {
    process.stdin.setRawMode(true);
}
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
app.get('*.*', express.static(outputFolder, {maxAge: 10 * 60 * 1000}));
// ---- SERVE APPLICATION PATHS ---- //
app.all('*', function (req, res) {
    res.status(200).sendFile(`/`, {root: outputFolder});
});

const delay = (ms) => new Promise(res => setTimeout(res, ms));

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

let nextApiCallTime = 0, apiCallCount = 0;
let collectedData = {}, foundContracts = {};
const zeroAddress = "0x0000000000000000000000000000000000000000";
const updateDatabase = async () => {
    console.log("Updating Database");
    let keySet = Object.keys(collectedData);

    for (let key of keySet) {
        let foundDoc = await userCollection.findOne({"effectiveAddress": key});
        if (foundDoc) {
            let latestBlockNumber = foundDoc["latestBlockNumber"]
            let latestTransactionHash = foundDoc["latestTransactionHash"];
            if (latestBlockNumber < collectedData[key]["latestBlockNumber"]) {
                latestBlockNumber = collectedData[key]["latestBlockNumber"];
                latestTransactionHash = collectedData[key]["latestTransactionHash"];
            }
            await userCollection.updateOne(foundDoc,
                {
                    "$set": {
                        latestTransactionHash,
                        latestBlockNumber,
                        "foundCount": (foundDoc["foundCount"] + collectedData[key]["foundCount"])
                    }
                });
        } else {
            collectedData[key]["hasSentNFT"] = false;
            await userCollection.insertOne(collectedData[key]);
        }
    }

    collectedData = {};
};
const preAPICallCheck = async (appendMessage = "") => {
    let currentTime = Date.now();
    if (currentTime < nextApiCallTime) {
        await delay(125);
    }
    nextApiCallTime = currentTime + 150;

    console.log(`API Call ${++apiCallCount} at ${Date.now()} for ${appendMessage}`);
};
const fetchDataFromMoralis = async (from_block, to_block, chain) => {
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
        await preAPICallCheck("getting NFT transfers");
        let nftTransfers = await Moralis.Web3API.token.getNftTransfersFromToBlock(options);
        cursor = nftTransfers["cursor"];

        let result = nftTransfers["result"];
        if (result.length === 0) {
            break;
        }

        for (let transfer of result) {
            if (transfer["block_number"] !== previousData["blockNumber"]) {
                console.log("Found NFT transfers in Block : " + transfer["block_number"]);
            }

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
            previousData["blockNumber"] = transfer["block_number"];

            if (shouldSave) {
                effectiveAddress = Web3.utils.toChecksumAddress(effectiveAddress);
                if (foundContracts[effectiveAddress] == null) {
                    if (collectedData[effectiveAddress] == null) {
                        let code = await web3.eth.getCode(effectiveAddress);
                        if (code === "0x") {
                            collectedData[effectiveAddress] = {
                                effectiveAddress,
                                "foundCount": 1,
                                "latestTransactionHash": transfer["transaction_hash"],
                                "latestBlockNumber": parseInt(transfer["block_number"])
                            };
                        } else {
                            foundContracts[effectiveAddress] = true;
                        }
                    } else {
                        collectedData[effectiveAddress]["foundCount"] += 1;
                    }
                }
            }
            if (testMode) {
                break;
            }
        }
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
    await Moralis.start({
        serverUrl: configData["moralisServerUrl"],
        masterKey: configData["moralisMasterKey"]
    });

    for (let currentStartBlock = startBlock; currentStartBlock >= endBlock; currentStartBlock -= 10) {
        let currentEndBlock = currentStartBlock - 9;
        if (currentEndBlock < endBlock) {
            currentEndBlock = endBlock;
        }

        /* The results returned by moralis are from higher block number to smaller block number */
        await fetchDataFromMoralis(currentEndBlock, currentStartBlock, chain);

        await updateDatabase();
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

let currentTokenIdIndex = -1, sendTransactionCount = 0, consecutiveFailure = 0;
const getTokenId = (tokenIdList) => {
    currentTokenIdIndex++;
    return tokenIdList[currentTokenIdIndex];
};
const sendNFTToWallet = async (web3, baseTransaction, senderPK, smartContract, functionName, params) => {
    let execFunction = smartContract.methods[functionName];
    baseTransaction["data"] = (typeof params === "object") ? execFunction(...params).encodeABI() : execFunction(params).encodeABI();

    let returnResult;
    try {
        let signedTransaction = await web3.eth.accounts.signTransaction(baseTransaction, senderPK);
        let transactionReceipt = await web3.eth.sendSignedTransaction(signedTransaction.rawTransaction);
        if (transactionReceipt.status) {
            consecutiveFailure = 0;
        } else {
            consecutiveFailure += 1;
            console.log(transactionReceipt);
        }
        returnResult = transactionReceipt.status;
    } catch (err) {
        console.log("Error when sending the NFT");
        console.log(err);
        consecutiveFailure += 1;
        returnResult = false;
    }
    if (consecutiveFailure >= 10) {
        throw "Encountered at least 10 consecutive send NFT failures. Exiting the script";
    }
    return returnResult;
};
const runSendNFTFunction = async (initParams) => {
    const web3 = new Web3(configData["moralisSpeedyUrl"]);
    const baseTransaction = {
        "chainId": await web3.eth.getChainId(),
        "from": initParams["senderWalletAddress"],
        "to": initParams["nftSenderContractAddress"],
        "value": 0,
        "gas": configData["sendNFTGasLimit"],
        "gasPrice": 0
    };
    const contractParams = configData["sendNFTFunctionParams"];
    const nftSenderContract = new web3.eth.Contract(initParams["nftSenderContractABI"], initParams["nftSenderContractAddress"]);
    contractParams[0] = initParams["holderWalletAddress"];

    let addressChangeIndex = -1, tokenIdChangeIndex = -1;
    for (let index = 0; index < contractParams.length; index++) {
        if (contractParams[index] === "#receiverAddress") {
            addressChangeIndex = index;
        } else if (contractParams[index] === "#tokenId") {
            tokenIdChangeIndex = index;
        }
    }

    let isStart = true;
    let documentWithUnsentNFT = await userCollection
        .find({"hasSentNFT": {"$in": [null, false]}})
        .sort({"latestBlockNumber": -1})
        .allowDiskUse();
    while (await documentWithUnsentNFT.hasNext()) {
        if (sendTransactionCount === 0) {
            baseTransaction["gasPrice"] = await web3.eth.getGasPrice();
            sendTransactionCount = 1;
            if (!isStart) {
                console.log("Transferred 25 NFTs. Transferring More...");
            } else {
                isStart = false;
            }
        } else {
            sendTransactionCount += 1;
            sendTransactionCount %= 25;
        }
        let currentDocument = await documentWithUnsentNFT.next();

        if (addressChangeIndex !== -1) {
            contractParams[addressChangeIndex] = currentDocument["effectiveAddress"];
        }
        if (tokenIdChangeIndex !== -1) {
            contractParams[tokenIdChangeIndex] = getTokenId(initParams["transferTokenIds"]);
            if (contractParams[tokenIdChangeIndex] === undefined) {
                return;
            }
        }

        let success = await sendNFTToWallet(web3, {...baseTransaction}, initParams["senderPrivateKey"],
            nftSenderContract, configData["sendNFTFunctionName"], contractParams);

        if (success) {
            await userCollection.updateOne({"effectiveAddress": currentDocument["effectiveAddress"]},
                {"$set": {"hasSentNFT": true}});
        }
        if (testMode) {
            break;
        }
    }
};

let isExecutingOperation = false;

io.on('connection', (socket) => {
    console.log(`User Connected : ${socket.id}`);

    socket.on('fetchPolygonNFTUsers', async (blockData) => {
        if (isExecutingOperation) {
            socket.emit('alreadyExecutingOperation');
        } else {
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
        if (isExecutingOperation) {
            socket.emit('alreadyExecutingOperation');
        } else {
            isExecutingOperation = true;
            try {
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
    });

    socket.on('disconnect', () => {
        console.log("User Disconnected : " + socket.id);
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
