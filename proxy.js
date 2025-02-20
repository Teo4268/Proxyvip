const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const net = require('net');

const PORT = process.env.PORT || 8088;
const blackPool = ["stratum-mining-pool.zapto.org"]; // Danh sách pool bị chặn

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function decodeBase64(encoded) {
  try {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  } catch (error) {
    return null;
  }
}

function proxySender(ws, conn) {
  ws.on('close', () => conn.end());
  ws.on('message', (cmd) => {
    try {
      const command = JSON.parse(cmd);
      const method = command.method;
      if (["mining.subscribe", "mining.authorize", "mining.submit"].includes(method)) {
        conn.send(cmd); // Gửi dữ liệu đến mining pool
      }
    } catch (error) {
      console.log(`[Error][INTERNAL] ${error}`);
      ws.close();
    }
  });
}

function proxyReceiver(conn, ws) {
  conn.on('message', (data) => ws.send(data)); // Nhận dữ liệu từ mining pool và gửi lại client
  conn.on('close', () => ws.close());
  conn.on('error', () => conn.terminate());
}

async function proxyMain(ws, req) {
  ws.on('message', (message) => {
    try {
      const command = JSON.parse(message);
      if (command.method === 'proxy.connect' && command.params.length === 1) {
        const encodedHost = command.params[0];
        const decoded = decodeBase64(encodedHost);

        if (!decoded) {
          ws.close();
          return;
        }

        const [host, port] = decoded.split(':');
        if (!host || !port || blackPool.includes(host) || port < 0 || port > 65535) {
          ws.close();
          return;
        }

        // Kết nối đến mining pool qua WebSocket thay vì TCP
        const conn = new WebSocket(`wss://${host}:${port}`);
        
        conn.on('open', () => {
          proxySender(ws, conn);
          proxyReceiver(conn, ws);
        });

        conn.on('error', (err) => {
          console.error(`[Error][WS] ${err.message}`);
          ws.close();
        });
      }
    } catch (error) {
      console.log(`[Error][INTERNAL] ${error}`);
      ws.close();
    }
  });
}

wss.on('connection', proxyMain);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
