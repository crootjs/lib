export function openWebSocketSetId(id, url_ws, onMessage) {
    if (!window["WebSocket"]) { //check browser support
        alert("Please Update Your browser to the latest version.");
        return Promise.reject(new Error("WebSocket not supported"));
    }
    return connectws(id, url_ws, onMessage);
}

export function connectws(id, url_ws, onMessage) {
  return new Promise(function(resolve, reject) {
      let wsconn = new WebSocket(atob(url_ws));
      wsconn.onopen = function() {
        wsconn.send(id);
        console.log("connected and set id");
        resolve(wsconn);
      };
      wsconn.onerror = function(err) {
        console.log("socket error rejected");
        reject(err);
      };
      wsconn.onclose = function (evt) {
        console.log("connection closed");
      };
      wsconn.onmessage = function (evt) {
        console.log("incoming message");
        if (typeof onMessage === "function") {
            onMessage(evt.data);
        }
      };

  });
}

export function closeWebSocket(wsocket){
  if (wsocket !== 0){
    wsocket.close();
  }
}

export function sendMessagetoWebSocket(msg,wsocket){
  if (wsocket.readyState === WebSocket.OPEN){
    wsocket.send(msg);
  }
}