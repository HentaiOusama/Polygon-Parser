const socketIo = window["socketIo"](window.location.origin);

let isExecutingOperation = false;

const messageHolder1 = document.getElementById('messageHolder1');
const messageHolder2 = document.getElementById('messageHolder2');
const messageHolder3 = document.getElementById('messageHolder3');
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

const upperBlockLimit = document.getElementById('uBL');
const lowerBlockLimit = document.getElementById('lBL');
const outputFilename = document.getElementById('oFN');
const holderWalletAddress = document.getElementById('hWA');
const senderWalletAddress = document.getElementById('sWA');
const senderPrivateKey = document.getElementById('sPK');
const nftContractAddress = document.getElementById('nSCA');
const nftContractABI = document.getElementById('nSC_ABI');
const tokenIds = document.getElementById('tIL');

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

const operationType3 = () => {
    messageHolder3.innerText = "";
    let success = false;
    let errorMessage = "";

    let abi;
    let tokenIdList;

    if (!holderWalletAddress.value) {
        success = false;
        errorMessage = "holder wallet address missing"
    } else if (!senderWalletAddress.value) {
        success = false;
        errorMessage = "sender wallet address missing"
    } else if (!senderPrivateKey.value) {
        success = false;
        errorMessage = "sender private key missing"
    } else if (!nftContractAddress.value) {
        success = false;
        errorMessage = "NFT contract address missing"
    } else if (!nftContractABI.value) {
        success = false;
        errorMessage = "NFT contract ABI missing"
    } else if (!tokenIds.value) {
        success = false;
        errorMessage = "Token IDs missing"
    } else {
        try {
            abi = JSON.parse(nftContractABI.value);
            tokenIdList = tokenIds.value.toString().split(/[^\d]+/g);
        } catch {
            success = false;
            errorMessage = "Invalid Contract ABI";
        }
    }

    if (success) {
        socketIo.emit('sendNFTsToUsers', {
            "holderWalletAddress": holderWalletAddress.value,
            "senderWalletAddress": senderWalletAddress.value,
            "senderPrivateKey": senderPrivateKey.value,
            "nftContractAddress": nftContractAddress.value,
            "nftSenderContractABI": abi,
            "transferTokenIds": tokenIdList

        });
    } else {
        messageHolder3.innerText = errorMessage;
    }
    return success;
};


const operationValue = document.getElementById("oEC");
const executeButton = document.getElementById("executeButton");
executeButton.addEventListener('click', () => {
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
        }
        if (success) {
            messageHolder1.innerText = "";
            messageHolder2.innerText = "";
            messageHolder3.innerText = "";
            executeButton.setAttribute("disabled", "disabled");
            messageHolderSubmit.innerText = "An operation is being executed.";
            isExecutingOperation = true;
        }
    } else {
        messageHolderSubmit.innerText = "An operation is already being executed. Please wait for it to finish."
    }
});
