const socketIo = window["socketIo"](window.location.origin);

let isExecutingOperation = false;

const operationType1 = () => {
    socketIo.emit('fetchPolygonNFTUsers');
    isExecutingOperation = true;
};

const operationType2 = () => {
    socketIo.emit('databaseToExcel');
    isExecutingOperation = true;
};

const operationType3 = () => {
    socketIo.emit('sendNFTsToUsers');
    isExecutingOperation = true;
};


const operationValue = document.getElementById("oEC");
const executeButton = document.getElementById("executeButton");
executeButton.addEventListener('click', () => {
    if (!isExecutingOperation) {
        switch (operationValue.value) {
            case "1":
                operationType1();
                break;

            case "2":
                operationType2();
                break;

            case "3":
                operationType3();
                break;
        }
    }
});
