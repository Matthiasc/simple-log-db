# simple-log-db 🪵



```js

const db = SimpleLogDB('./db.log')

//options
SimpleLogDB('./db.log',{
    maxFileSize: 5 * 1024 * 1024, // Default to 5MB
    maxFileCount: 5, //default
    addTimestamp: true, //default
    rotationEnabled: true, //default
})

// add entry
db.add({metric:"cpu_temp",value:62})

//add multiple entries
db.add([
    {metric:"cpu_temp", value:62},
    {metric:"cpu_temp", value:63}
]);

//read last
const lastEntry = db.last(); // `{metric:"cpu_temp", value:63}`

//read 2 last entries
const twoLastEntries = db.last(2) // [{metric:"cpu_temp", value:62}, {metric:"cpu_temp", value:63}]

//clear db all
db.clear();
