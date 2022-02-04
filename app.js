const testMode = false;

// Function that can be used in future. Uncomment as per need.
//
// const delay = (ms) => new Promise(res => setTimeout(res, ms));
//
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

const configData = require('./configData.json');
const readLine = require("readline-sync");
const Json2csvParser = require('json2csv').Parser;
const fs = require('fs');
const {MongoClient, Collection} = require('mongodb');
const Moralis = require('moralis/node');
const Web3 = require('web3');


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


let currentTokenIdIndex = -1, sendTransactionCount = 0, consecutiveFailure = 0;
const getTokenId = () => {
    currentTokenIdIndex++;
    return configData["transferTokenIds"][currentTokenIdIndex];
};
const sendNFTToWallet = async (web3, baseTransaction, smartContract, functionName, params) => {
    let execFunction = smartContract.methods[functionName];
    baseTransaction["data"] = (typeof params === "object") ? execFunction(...params).encodeABI() : execFunction(params).encodeABI();

    let returnResult;
    try {
        let signedTransaction = await web3.eth.accounts.signTransaction(baseTransaction, configData["walletPrivateKey"]);
        let transactionReceipt = await web3.eth.sendSignedTransaction(signedTransaction.rawTransaction);
        if (!transactionReceipt.status) {
            consecutiveFailure += 1;
        } else {
            consecutiveFailure = 0;
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
const runSendNFTScript = async () => {
    const web3 = new Web3(configData["moralisSpeedyUrl"]);
    const baseTransaction = {
        "chainId": await web3.eth.getChainId(),
        "to": configData["nftSenderContractAddress"],
        "value": 0,
        "gas": configData["sendNFTGasLimit"],
        "gasPrice": 0
    };
    const nftSenderContract = new web3.eth.Contract(configData["nftSenderContractABI"], configData["nftSenderContractAddress"], {
        "from": configData["walletPublicKey"]
    });
    const contractParams = configData["sendNFTFunctionParams"];

    let addressChangeIndex = -1, tokenIdChangeIndex = -1;
    for (let index = 0; index < contractParams.length; index++) {
        if (contractParams[index] === "#receiverAddress") {
            addressChangeIndex = index;
        } else if (contractParams[index] === "#tokenId") {
            tokenIdChangeIndex = index;
        }
    }

    let documentWithUnsentNFT = await userCollection.find({"hasSentNFT": {"$in": [null, false]}});
    while (await documentWithUnsentNFT.hasNext()) {
        if (sendTransactionCount === 0) {
            baseTransaction["gasPrice"] = await web3.eth.getGasPrice();
            sendTransactionCount = 1;
        } else {
            sendTransactionCount += 1;
            sendTransactionCount %= 10;
        }
        let currentDocument = await documentWithUnsentNFT.next();

        if (addressChangeIndex !== -1) {
            contractParams[addressChangeIndex] = currentDocument["effectiveAddress"];
        }
        if (tokenIdChangeIndex !== -1) {
            contractParams[tokenIdChangeIndex] = getTokenId();
            if (contractParams[tokenIdChangeIndex] === undefined) {
                throw "All Token Ids Exhausted";
            }
        }

        let success = await sendNFTToWallet(web3, {...baseTransaction}, nftSenderContract, configData["sendNFTFunctionName"], contractParams);

        if (success) {
            await userCollection.updateOne({"effectiveAddress": currentDocument["effectiveAddress"]},
                {"$set": {"hasSentNFT": true}});
        }
        if (testMode) {
            break;
        }
    }
};


const databaseToExcel = async () => {
    let allDocuments = await userCollection.find({}).toArray();
    const json2csvParser = new Json2csvParser({header: true});
    const csvData = json2csvParser.parse(allDocuments);
    fs.writeFile("./userData.csv", csvData, function (err) {
        if (err) {
            throw err;
        }
    });
};


let collectedData = {};
const zeroAddress = "0x0000000000000000000000000000000000000000";
const updateDatabase = async () => {
    let keySet = Object.keys(collectedData);

    for (let key of keySet) {
        let foundDoc = await userCollection.findOne({"effectiveAddress": key});
        if (foundDoc) {
            await userCollection.updateOne(foundDoc,
                {"$set": {"foundCount": (foundDoc["foundCount"] + collectedData[key]["foundCount"])}});
        } else {
            collectedData[key]["hasSentNFT"] = false;
            await userCollection.insertOne(collectedData[key]);
        }
    }

    collectedData = {};
};
const fetchDataFromMoralis = async (from_block, to_block, chain) => {
    let cursor;
    let options = {
        chain,
        from_block,
        to_block
    };
    let effectiveAddress = "", operationType,
        previousData = {"operationType": "", "transactionHash": "", blockNumber: ""};

    do {
        if (cursor) {
            options["cursor"] = cursor;
        }
        let nftTransfers = await Moralis.Web3API.token.getNftTransfersFromToBlock(options);
        cursor = nftTransfers["cursor"];

        let result = nftTransfers["result"];
        if (result.length === 0) {
            break;
        }

        for (let transfer of result) {
            if (transfer["block_number"] !== previousData["blockNumber"]) {
                console.log("Current Block Number : " + transfer["block_number"]);
            }

            let shouldSave = true;
            if (transfer["from_address"] === zeroAddress) {
                operationType = "Mint";
                if (transfer["transaction_hash"] !== previousData["transactionHash"] || operationType !== previousData["operationType"]) {
                    let transaction = await Moralis.Web3API.native.getTransaction({
                        chain,
                        "transaction_hash": transfer["transaction_hash"]
                    });
                    effectiveAddress = transaction["from_address"];
                } else {
                    shouldSave = false;
                    collectedData[effectiveAddress]["foundCount"] += 1;
                }
            } else if (transfer["to_address"] === zeroAddress) {
                effectiveAddress = transfer["from_address"];
                operationType = "Burn"
            } else {
                effectiveAddress = transfer["from_address"]
                operationType = "Transfer"
            }

            effectiveAddress = Web3.utils.toChecksumAddress(effectiveAddress);
            previousData["operationType"] = operationType;
            previousData["transactionHash"] = transfer["transaction_hash"];
            previousData["blockNumber"] = transfer["block_number"];

            if (shouldSave) {
                if (collectedData[effectiveAddress] == null) {
                    collectedData[effectiveAddress] = {
                        effectiveAddress,
                        "foundCount": 1,
                        "latestTransactionHash": transfer["transaction_hash"]
                    };
                } else {
                    collectedData[effectiveAddress]["foundCount"] += 1;
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
const runFetchDataScript = async (startBlock, endBlock, chain = "polygon") => {
    // Assert the startBlock >= endBlock
    if (startBlock < endBlock) {
        throw "endBlock cannot be less than the startBlock";
    }
    await Moralis.start({
        serverUrl: configData["moralisServerUrl"],
        appId: configData["moralisAppId"],
    });

    for (let currentStartBlock = startBlock; currentStartBlock >= endBlock; currentStartBlock -= 5) {
        let currentEndBlock = currentStartBlock - 4;
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


const mainFunction = async () => {
    console.log("Connecting to the database...\n");
    await connectToDatabase();

    try {
        let userChoice = parseInt(
            readLine.question("" +
                "Menu: -\n" +
                "1. Gather user addresses and store in database\n" +
                "2. Store database content in excel file (.csv)\n" +
                "3. Send NFTs to user addresses in database\n\n" +
                "Enter choice (1, 2, or 3) : ").toString()
        );

        if (1 <= userChoice <= 3) {
            try {
                if (userChoice === 1) {
                    let input = readLine.question("Enter upperBlockLimit & lowerBlockLimit (space seperated) : ").toString().split(" ");
                    await runFetchDataScript(parseInt(input[0]), parseInt(input[1]));
                } else if (userChoice === 2) {
                    await databaseToExcel();
                } else if (userChoice === 3) {
                    await runSendNFTScript();
                }
            } catch (err) {
                console.log("Script Error\n", err);
            }
        } else {
            console.log("Invalid Input");
        }
    } catch (err) {
        console.log("Error encounters\n", err);
    }

    console.log("\nDisconnecting from database...");
    await mongoClient.close();
};
mainFunction().then(() => {
    console.log("Script Execution Successful");
}).catch((err) => {
    console.log("Database Connection Error\n", err);
});
