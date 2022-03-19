"use strict";

const socketIo = window["socketIo"](window.location.origin);

class CookieService {
    getCookie = (cookieName) => {
        let ca = document.cookie.split(';');
        let caLen = ca.length;
        cookieName = "".concat(cookieName, "=");
        let c;
        for (let i = 0; i < caLen; i += 1) {
            c = ca[i].replace(/^\s+/g, '');
            if (c.indexOf(cookieName) === 0) {
                return c.substring(cookieName.length, c.length);
            }
        }
        return null;
    };

    setCookie = (params) => {
        let d = new Date();
        d.setTime(d.getTime() + (params.expireDays ? params.expireDays : 1) * 24 * 60 * 60 * 1000);
        document.cookie =
            (params.name ? params.name : '') + "=" + (params.value ? params.value : '') + ";"
            + (params.session && params.session === true ? "" : "expires=" + d.toUTCString() + ";")
            + "path=" + (params.path && params.path.length > 0 ? params.path : "/") + ";"
            + (location.protocol === 'https:' && params.secure ? "secure" : "");
    };

    deleteCookie = (cookieName) => {
        this.setCookie({name: cookieName, value: '', expireDays: -1});
    };
}

let cookieService = new CookieService();

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
    if (data["success"] === "true" || data["success"] === true) {
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
    if (data["success"] === "true" || data["success"] === true) {
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
    if (data["success"] === "true" || data["success"] === true) {
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
    if (data["success"] === "true" || data["success"] === true) {
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

let cookieValue;

const upperBlockLimit = document.getElementById('uBL');
const lowerBlockLimit = document.getElementById('lBL');

const outputFilename = document.getElementById('oFN');

const nftFormResetButton = document.getElementById("nRB");
const nftSendUpperBlockLimit = document.getElementById('nSUBL');
const nftSendLowerBlockLimit = document.getElementById('nSLBL');
const nftGasScaling = document.getElementById('nGS');
const nftSenderWalletAddress = document.getElementById('nSWA');
const nftSenderPrivateKey = document.getElementById('nSPK');
const nftSPKToggleButton = document.getElementById('nPKTB');
const nftContractAddress = document.getElementById('nSCA');
const nftTokenIdList = document.getElementById('nTIL');
const nftCustomAddresses = document.getElementById('nCAL');

cookieValue = cookieService.getCookie("nSUBL");
if (cookieValue) {
    nftSendUpperBlockLimit.value = cookieValue;
}
cookieValue = cookieService.getCookie("nSLBL");
if (cookieValue) {
    nftSendLowerBlockLimit.value = cookieValue;
}
cookieValue = cookieService.getCookie("nGS");
if (cookieValue) {
    nftGasScaling.value = cookieValue;
}
cookieValue = cookieService.getCookie("nSWA");
if (cookieValue) {
    nftSenderWalletAddress.value = cookieValue;
}
cookieValue = cookieService.getCookie("nSPK");
if (cookieValue) {
    nftSenderPrivateKey.value = cookieValue;
}
cookieValue = cookieService.getCookie("nSCA");
if (cookieValue) {
    nftContractAddress.value = cookieValue;
}
cookieValue = cookieService.getCookie("nTIL");
if (cookieValue) {
    nftTokenIdList.value = cookieValue;
}
cookieValue = window.localStorage.getItem("nCAL");
if (cookieValue) {
    nftCustomAddresses.value = cookieValue;
}

const erc20FormResetButton = document.getElementById("eRB");
const erc20SendUpperBlockLimit = document.getElementById('eSUBL');
const erc20SendLowerBlockLimit = document.getElementById('eSLBL');
const erc20GasScaling = document.getElementById('eGS');
const erc20SenderWalletAddress = document.getElementById('eSWA');
const erc20SenderPrivateKey = document.getElementById('eSPK');
const erc20SPKToggleButton = document.getElementById('ePKTB')
const erc20ContractAddress = document.getElementById('eSCA');
const erc20SendAmount = document.getElementById('eRA');
const erc20TokenDecimals = document.getElementById('eSCD');
const erc20CustomAddresses = document.getElementById('eCAL');

cookieValue = cookieService.getCookie("eSUBL");
if (cookieValue) {
    erc20SendUpperBlockLimit.value = cookieValue;
}
cookieValue = cookieService.getCookie("eSLBL");
if (cookieValue) {
    erc20SendLowerBlockLimit.value = cookieValue;
}
cookieValue = cookieService.getCookie("eGS");
if (cookieValue) {
    erc20GasScaling.value = cookieValue;
}
cookieValue = cookieService.getCookie("eSWA");
if (cookieValue) {
    erc20SenderWalletAddress.value = cookieValue;
}
cookieValue = cookieService.getCookie("eSPK");
if (cookieValue) {
    erc20SenderPrivateKey.value = cookieValue;
}
cookieValue = cookieService.getCookie("eSCA");
if (cookieValue) {
    erc20ContractAddress.value = cookieValue;
}
cookieValue = window.localStorage.getItem("eCAL");
if (cookieValue) {
    erc20CustomAddresses.value = cookieValue;
}

let nftToggleType = "password", erc20ToggleType = "password";
nftSPKToggleButton.addEventListener('click', () => {
    if (nftToggleType === "password") {
        nftToggleType = "text";
        nftSPKToggleButton.innerText = "Hide";
    } else {
        nftToggleType = "password";
        nftSPKToggleButton.innerText = "Show";
    }
    nftSenderPrivateKey.setAttribute("type", nftToggleType);
});
erc20SPKToggleButton.addEventListener('click', () => {
    if (erc20ToggleType === "password") {
        erc20ToggleType = "text";
        erc20SPKToggleButton.innerText = "Hide";
    } else {
        erc20ToggleType = "password";
        erc20SPKToggleButton.innerText = "Show";
    }
    erc20SenderPrivateKey.setAttribute("type", erc20ToggleType);
});
nftFormResetButton.addEventListener('click', () => {
    nftSendUpperBlockLimit.value = "";
    nftSendLowerBlockLimit.value = "";
    nftGasScaling.value = "40";
    nftSenderWalletAddress.value = "";
    nftSenderPrivateKey.value = "";
    nftContractAddress.value = "";
    nftTokenIdList.value = "";
    nftCustomAddresses.value = "";
});
erc20FormResetButton.addEventListener('click', () => {
    erc20SendUpperBlockLimit.value = "";
    erc20SendLowerBlockLimit.value = "";
    erc20GasScaling.value = "40";
    erc20SenderWalletAddress.value = "";
    erc20SenderPrivateKey.value = "";
    erc20ContractAddress.value = "";
    erc20CustomAddresses.value = "";
});

const buildCustomAddressesList = (sendData, customAddressList) => {
    let len = customAddressList.length;
    for (let i = 0; i < len; i++) {
        if (customAddressList[i] && web3.utils.isAddress(customAddressList[i])) {
            customAddressList.push(web3.utils.toChecksumAddress(customAddressList[i]));
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
    return ((BigInt(gasPrice) * 150n) / 100n).toString();
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

    let gasScaling = 40;
    try {
        gasScaling = parseInt(nftGasScaling.value);
        if (gasScaling < 0) {
            gasScaling = 0;
        }
    } catch {
    }
    gasScaling += 100;

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
                "0x3D08da4a9C0Ef831f15f4A4212CF57ABD3689691"
            ).call();

            if (!hasApprovedAll) {
                let gasPrice = await getGasPrice();
                try {
                    messageHolder3.innerText = "Waiting For Confirmation of Approve Transaction (Do NOT speed up the transaction).";
                    await nftSmartContract.methods["setApprovalForAll"]("0x3D08da4a9C0Ef831f15f4A4212CF57ABD3689691", true).send({
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
            gasScaling,
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

        cookieService.setCookie({
            "name": "nSUBL",
            "value": nftSendUpperBlockLimit.value,
            "expiryDays": 365
        });
        cookieService.setCookie({
            "name": "nSLBL",
            "value": nftSendLowerBlockLimit.value,
            "expiryDays": 365
        });
        cookieService.setCookie({
            "name": "nGS",
            "value": nftGasScaling.value,
            "expiryDays": 365
        });
        cookieService.setCookie({
            "name": "nSWA",
            "value": nftSenderWalletAddress.value,
            "expiryDays": 365
        });
        cookieService.setCookie({
            "name": "nSPK",
            "value": nftSenderPrivateKey.value,
            "expiryDays": 365
        });
        cookieService.setCookie({
            "name": "nSCA",
            "value": nftContractAddress.value,
            "expiryDays": 365
        });
        cookieService.setCookie({
            "name": "nTIL",
            "value": nftTokenIdList.value,
            "expiryDays": 365
        });
        window.localStorage.setItem("nCAL", nftCustomAddresses.value);

        socketIo.emit('sendNFTsToUsers', sendData);
    } else {
        messageHolder3.innerText = errorMessage;
    }
    return success;
};

const operationType4 = async () => {
    messageHolder4.innerText = "";
    let success = false, errorMessage = "";

    let gasScaling = 40;
    try {
        gasScaling = parseInt(erc20GasScaling.value);
        if (gasScaling < 0) {
            gasScaling = 0;
        }
    } catch {
    }
    gasScaling += 100;

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
            gasScaling,
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

        cookieService.setCookie({
            "name": "eSUBL",
            "value": erc20SendUpperBlockLimit.value,
            "expiryDays": 365
        });
        cookieService.setCookie({
            "name": "eSLBL",
            "value": erc20SendLowerBlockLimit.value,
            "expiryDays": 365
        });
        cookieService.setCookie({
            "name": "eGS",
            "value": erc20GasScaling.value,
            "expiryDays": 365
        });
        cookieService.setCookie({
            "name": "eSWA",
            "value": erc20SenderWalletAddress.value,
            "expiryDays": 365
        });
        cookieService.setCookie({
            "name": "eSPK",
            "value": erc20SenderPrivateKey.value,
            "expiryDays": 365
        });
        cookieService.setCookie({
            "name": "eSCA",
            "value": erc20ContractAddress.value,
            "expiryDays": 365
        });
        window.localStorage.setItem("eCAL", erc20CustomAddresses.value);

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
