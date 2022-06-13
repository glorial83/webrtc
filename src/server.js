import express from "express";
import { createServer } from "https";
import { readFileSync } from "fs";
import { nanoid } from "nanoid";
import path, { resolve } from "path";
import { fileURLToPath } from "url";
import WebSocket, { WebSocketServer } from "ws";
import { create } from "domain";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const appServer = createServer(
  {
    cert: readFileSync(resolve(__dirname, "./../ssl/cert.pem")),
    key: readFileSync(resolve(__dirname, "./../ssl/cert.key")),
  },
  app
).listen(3000);

app.use(express.static(resolve(__dirname, "./../public")));

const wsServer = createServer({
  cert: readFileSync(resolve(__dirname, "./../ssl/cert.pem")),
  key: readFileSync(resolve(__dirname, "./../ssl/cert.key")),
});

const wss = new WebSocketServer({ server: wsServer });

wss.on("connection", (socket) => {
  console.log("new connection");

  socket.on("message", (data) => {
    //console.log("socket:message data=%s", data);

    try {
      const jsonMessage = JSON.parse(data);
      handleJsonMessage(socket, jsonMessage);
    } catch (error) {
      console.error("failed to handle onmessage", error);
    }
  });

  socket.once("close", () => {
    console.log("socket::close");
  });
});

const handleJsonMessage = (socket, jsonMessage) => {
  switch (jsonMessage.action) {
    case "start":
      socket.id = nanoid();
      emitMessage(socket, { action: "start", id: socket.id });
      break;

    default:
      if (!jsonMessage.data.remoteId) return;

      const remotePeerSocket = getSocketById(jsonMessage.data.remoteId);

      if (!remotePeerSocket) {
        return console.log(
          "failed to find remote socket with id",
          jsonMessage.data.remoteId
        );
      }

      if (jsonMessage.action !== "offer") {
        delete jsonMessage.data.remoteId;
      } else {
        jsonMessage.data.remoteId = socket.id;
      }

      emitMessage(remotePeerSocket, jsonMessage);
  }
};

const emitMessage = (socket, jsonMessage) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(jsonMessage));
  }
};

const getSocketById = (socketId) =>
  Array.from(wss.clients).find((client) => client.id === socketId);

wsServer.listen(8888);
console.log("app server listenling on port 3000");
console.log("wss server listenling on port 8888");
