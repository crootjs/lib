export function getDateFromObjectId(stringID){
    return new Date(parseInt(stringID.substr(0,8), 16)*1000);
}

export function generateObjectId(){
    var timestamp = (new Date().getTime() / 1000 | 0).toString(16);
    var randomnum = 'xxxxxxxxxxxxxxxx'.replace(/[x]/g, function() {
        return (Math.random() * 16 | 0).toString(16);
    }).toLowerCase();
    return timestamp+randomnum
}