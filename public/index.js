const socketIo = window["socketIo"](window.location.origin);

const versionHolder = document.getElementById("cSVH");
socketIo.emit('getSoftwareVersion');
socketIo.on('setSoftwareVersion', (softwareVersion) => {
    versionHolder.innerText = "Software Version: " + softwareVersion;
});

let userAccount = null;
window["ethereum"].on('accountsChanged', (acc) => {
    userAccount = window["web3"].utils.toChecksumAddress(acc[0]);
    console.log("Account Changed to : " + userAccount);
});
window["ethereum"].request({method: 'eth_requestAccounts'}).then((acc) => {
    userAccount = window["web3"].utils.toChecksumAddress(acc[0]);
    console.log("Account Changed to : " + userAccount);
}).catch((err) => {
    console.log("Error getting user accounts");
    console.log(err);
    userAccount = null;
});

let isExecutingOperation = false;

const messageHolder1 = document.getElementById('messageHolder1');
const messageHolder2 = document.getElementById('messageHolder2');
const messageHolder3 = document.getElementById('messageHolder3');
const messageHolder4 = document.getElementById('messageHolder4');
const messageHolderSubmit = document.getElementById('messageHolderSubmit');

socketIo.on('fetchPolygonNFTUsersResult', (data) => {
    if (data["success"]) {
        messageHolder1.innerText = "Operation completed successfully";
    } else {
        messageHolder1.innerText = JSON.stringify(data["error"]);
        console.log(data["error"]);
    }
    isExecutingOperation = false;
    executeButton.removeAttribute("disabled");
    messageHolderSubmit.innerText = "";
});
socketIo.on('databaseToExcelResult', (data) => {
    if (data["success"]) {
        messageHolder2.innerText = "Operation completed successfully";
    } else {
        messageHolder2.innerText = JSON.stringify(data["error"]);
        console.log(data["error"]);
    }
    isExecutingOperation = false;
    executeButton.removeAttribute("disabled");
    messageHolderSubmit.innerText = "";
});
socketIo.on('sendNFTsToUsersResult', (data) => {
    if (data["success"]) {
        messageHolder3.innerText = "Operation completed successfully";
    } else {
        messageHolder3.innerText = JSON.stringify(data["error"]);
        console.log(data["error"]);
    }
    isExecutingOperation = false;
    executeButton.removeAttribute("disabled");
    messageHolderSubmit.innerText = "";
});
socketIo.on('sendERC20ToUsersResult', (data) => {
    if (data["success"]) {
        messageHolder4.innerText = "Operation completed successfully";
    } else {
        messageHolder4.innerText = JSON.stringify(data["error"]);
        console.log(data["error"]);
    }
    isExecutingOperation = false;
    executeButton.removeAttribute("disabled");
    messageHolderSubmit.innerText = "";
});
socketIo.on('alreadyExecutingOperation', () => {
    messageHolderSubmit.innerText = "An operation is already being executed. Please wait for it to finish.";
});

const upperBlockLimit = document.getElementById('uBL');
const lowerBlockLimit = document.getElementById('lBL');

const outputFilename = document.getElementById('oFN');

const nftSendUpperBlockLimit = document.getElementById('nSUBL');
const nftSendLowerBlockLimit = document.getElementById('nSLBL');
const nftSenderWalletAddress = document.getElementById('nSWA');
const nftSenderPrivateKey = document.getElementById('nSPK');
const nftContractAddress = document.getElementById('nSCA');
const nftTokenIdList = document.getElementById('nTIL');
const nftCustomAddresses = document.getElementById('nCAL');

const erc20SendUpperBlockLimit = document.getElementById('eSUBL');
const erc20SendLowerBlockLimit = document.getElementById('eSLBL');
const erc20SenderWalletAddress = document.getElementById('eSWA');
const erc20SenderPrivateKey = document.getElementById('eSPK');
const erc20ContractAddress = document.getElementById('eSCA');
const erc20SendAmount = document.getElementById('eRA');
const erc20TokenDecimals = document.getElementById('eSCD');
const erc20CustomAddresses = document.getElementById('eCAL');

const buildCustomAddressesList = (sendData, customAddressList) => {
    let len = customAddressList.length;
    for (let i = 0; i < len; i++) {
        if (customAddressList[i]) {
            customAddressList.push(customAddressList[i]);
        }
    }
    customAddressList.splice(0, len);
    sendData["customAddressList"] = customAddressList;
    sendData["useCustomAddressList"] = true;
};
const requireCorrectWallet = (requiredWalletAddress) => {
    return userAccount.toLowerCase() === requiredWalletAddress.toLowerCase();
};
const getGasPrice = async () => {
    let gasPrice = await window["web3"].eth.getGasPrice();
    console.log("Gas Price : " + gasPrice);
    return ((BigInt(gasPrice) * 125n) / 100n).toString();
};

const operationType1 = () => {
    messageHolder1.innerText = "";
    let uBL = parseInt(upperBlockLimit.value), lBL = parseInt(lowerBlockLimit.value);

    if (uBL && lBL && uBL >= lBL) {
        socketIo.emit('fetchPolygonNFTUsers', {
            "upperBlockLimit": uBL,
            "lowerBlockLimit": lBL
        });
        return true;
    } else {
        messageHolder1.innerText = "Invalid input values. Make sure that uBL >= lBL."
        return false;
    }
};

const operationType2 = () => {
    messageHolder2.innerText = "";
    let filename = outputFilename.value.toString();
    if (filename && !filename.endsWith(".csv")) {
        filename += ".csv";
    } else {
        filename = "userData.csv";
    }

    socketIo.emit('databaseToExcel', {
        "outputFileName": filename
    });
    return true;
};

const operationType3 = async () => {
    messageHolder3.innerText = "";
    let success = false, errorMessage = "", nftType, tokenIdList = null;

    if (!nftSenderWalletAddress.value) {
        errorMessage = "sender wallet address missing";
    } else if (!nftSenderPrivateKey.value) {
        errorMessage = "sender private key missing";
    } else if (!nftContractAddress.value) {
        errorMessage = "NFT contract address missing";
    } else if (!nftTokenIdList.value) {
        errorMessage = "Token Ids missing";
    } else if (!requireCorrectWallet(nftSenderWalletAddress.value.toString())) {
        errorMessage = "Wrong wallet selected in metamask. Please select " + nftSenderWalletAddress.value;
    } else {
        if (document.querySelector('input[name="NFT-Type"]:checked').value === '0') {
            nftType = "ERC-1155";
        } else {
            nftType = "ERC-721";
        }
        try {
            tokenIdList = nftTokenIdList.value.toString().trim().split(/[^\d]+/g);
            let len = tokenIdList.length;

            for (let i = 0; i < len; i++) {
                if (tokenIdList[i]) {
                    try {
                        tokenIdList.push(parseInt(tokenIdList[i]));
                    } catch {
                    }
                }
            }

            tokenIdList.splice(0, len);

            success = true;
        } catch (err) {
            success = false;
            console.log(err);
            errorMessage = "Invalid TokenIds";
        }
    }

    // Get user to approve NFT Tokens.
    if (success) {
        try {
            const nftSmartContract = new window["web3"].eth.Contract([
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "account",
                            "type": "address"
                        },
                        {
                            "internalType": "address",
                            "name": "operator",
                            "type": "address"
                        }
                    ],
                    "name": "isApprovedForAll",
                    "outputs": [
                        {
                            "internalType": "bool",
                            "name": "",
                            "type": "bool"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "operator",
                            "type": "address"
                        },
                        {
                            "internalType": "bool",
                            "name": "approved",
                            "type": "bool"
                        }
                    ],
                    "name": "setApprovalForAll",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ], nftContractAddress.value);
            let hasApprovedAll = await nftSmartContract.methods["isApprovedForAll"](
                nftSenderWalletAddress.value,
                "0xE3eEe9323469E2979BA91e2aD787036D54Ff650a"
            ).call();

            if (!hasApprovedAll) {
                let gasPrice = await getGasPrice();
                try {
                    messageHolder3.innerText = "Waiting For Confirmation of Approve Transaction (Do NOT speed up the transaction).";
                    await nftSmartContract.methods["setApprovalForAll"]("0xE3eEe9323469E2979BA91e2aD787036D54Ff650a", true).send({
                        "from": nftSenderWalletAddress.value,
                        gasPrice
                    });
                    messageHolder3.innerText = "";
                } catch (err) {
                    success = false;
                    console.log(err);
                    messageHolder3.innerText = "Approve Transaction Failed."
                }
            }
        } catch (err) {
            success = false;
            console.log(err);
            messageHolder3.innerText = "Unable to fetch data from blockchain.";
        }
    }

    if (success) {
        let sendData = {
            "senderWalletAddress": nftSenderWalletAddress.value,
            "senderPrivateKey": nftSenderPrivateKey.value,
            "nftContractAddress": nftContractAddress.value,
            "sendFunctionParamCount": ((nftType === "ERC-721") ? 4 : 5),
            tokenIdList
        };

        if (nftSendUpperBlockLimit.value) {
            try {
                sendData["sendUpperBlockLimit"] = parseInt(nftSendUpperBlockLimit.value);
            } catch {
            }
        }
        if (nftSendLowerBlockLimit.value) {
            try {
                sendData["sendLowerBlockLimit"] = parseInt(nftSendLowerBlockLimit.value);
            } catch {
            }
        }
        if (document.querySelector('input[name="uNCAL"]:checked').value === '1') {
            buildCustomAddressesList(sendData, nftCustomAddresses.value.toString().trim().split(/[^\dA-Fa-fx]+/g));
        }

        socketIo.emit('sendNFTsToUsers', sendData);
    } else {
        messageHolder3.innerText = errorMessage;
    }
    return success;
};

const operationType4 = async () => {
    messageHolder4.innerText = "";
    let success = false, errorMessage = "";

    if (!erc20SenderWalletAddress.value) {
        errorMessage = "sender wallet address missing";
    } else if (!erc20SenderPrivateKey.value) {
        errorMessage = "sender private key missing";
    } else if (!erc20ContractAddress.value) {
        errorMessage = "ERC20 Token contract address missing";
    } else if (!erc20SendAmount.value) {
        errorMessage = "Send Amount missing";
    } else if (erc20SendAmount.value.toString().includes(".")) {
        errorMessage = "Send Amount cannot contain decimal";
    } else if (!erc20TokenDecimals.value) {
        errorMessage = "Send Token Decimals missing";
    } else if (!requireCorrectWallet(erc20SenderWalletAddress.value.toString())) {
        errorMessage = "Wrong wallet selected in metamask. Please select " + erc20SenderWalletAddress.value;
    } else {
        success = true;
    }

    // Get user to approve ERC20 Tokens.
    if (success) {
        try {
            const erc20SmartContract = new window["web3"].eth.Contract([
                {
                    "inputs": [{
                        "internalType": "address",
                        "name": "spender",
                        "type": "address"
                    }, {"internalType": "uint256", "name": "tokens", "type": "uint256"}],
                    "name": "approve",
                    "outputs": [{"internalType": "bool", "name": "success", "type": "bool"}],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "decimals",
                    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "totalSupply",
                    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ], erc20ContractAddress.value);
            let decimalCount = await erc20SmartContract.methods["decimals"]().call();
            erc20TokenDecimals.innerText = decimalCount;
            erc20TokenDecimals.value = decimalCount;
            let totalSupply = await erc20SmartContract.methods["totalSupply"]().call();
            let gasPrice = await getGasPrice();

            try {
                messageHolder4.innerText = "Waiting For Confirmation of Approve Transaction (Do NOT speed up the transaction).";
                await erc20SmartContract.methods["approve"]("0x1b5e3e7B265E8Fa8Ee8c41ED07B046f0318E8412", totalSupply).send({
                    "from": userAccount,
                    gasPrice
                });
                messageHolder4.innerText = "";
            } catch (err) {
                success = false;
                console.log(err);
                messageHolder4.innerText = "Approve Transaction Failed."
            }
        } catch (err) {
            success = false;
            console.log(err);
            messageHolder4.innerText = "Unable to fetch data from blockchain.";
        }
    }

    if (success) {
        let sendData = {
            "senderWalletAddress": erc20SenderWalletAddress.value,
            "senderPrivateKey": erc20SenderPrivateKey.value,
            "erc20TokenAddress": erc20ContractAddress.value,
            "transferAmount": erc20SendAmount.value.toString() + "0".repeat(parseInt(erc20TokenDecimals.value))
        };

        if (erc20SendUpperBlockLimit.value) {
            try {
                sendData["sendUpperBlockLimit"] = parseInt(erc20SendUpperBlockLimit.value);
            } catch {
            }
        }
        if (erc20SendLowerBlockLimit.value) {
            try {
                sendData["sendLowerBlockLimit"] = parseInt(erc20SendLowerBlockLimit.value);
            } catch {
            }
        }
        if (document.querySelector('input[name="uECAL"]:checked').value === '1') {
            buildCustomAddressesList(sendData, erc20CustomAddresses.value.toString().trim().split(/[^\dA-Fa-fx]+/g));
        }

        socketIo.emit('sendERC20ToUsers', sendData);
    } else {
        messageHolder4.innerText = errorMessage;
    }
    return success;
};


const operationValue = document.getElementById("oEC");
const executeButton = document.getElementById("executeButton");
executeButton.addEventListener('click', async () => {
    let success = false;
    if (!isExecutingOperation) {
        switch (operationValue.value) {
            case "1":
                success = operationType1();
                break;

            case "2":
                success = operationType2();
                break;

            case "3":
                if (userAccount) {
                    success = await operationType3();
                } else {
                    messageHolderSubmit.innerText = "Wallet not connected. Cannot execute this operation.";
                }
                break;

            case "4":
                if (userAccount) {
                    success = await operationType4();
                } else {
                    messageHolderSubmit.innerText = "Wallet not connected. Cannot execute this operation.";
                }
                break;
        }
        if (success) {
            isExecutingOperation = true;
            messageHolder1.innerText = "";
            messageHolder2.innerText = "";
            messageHolder3.innerText = "";
            messageHolder4.innerText = "";
            executeButton.setAttribute("disabled", "disabled");
            messageHolderSubmit.innerText = "An operation is being executed.";
        }
    } else {
        messageHolderSubmit.innerText = "An operation is already being executed. Please wait for it to finish.";
    }
});
