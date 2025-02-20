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
  ws.on('message', (message) => {
    try {
        // Giải mã Base64
        const decodedMessage = Buffer.from(message.toString(), 'base64').toString('utf8');
        
        // Parse JSON sau khi giải mã
        const command = JSON.parse(decodedMessage);
        
        console.log('Decoded command:', command);
    } catch (error) {
        console.log(`[Error] Unable to decode/parse: ${error.message}`);
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
        let decodedMessage;
        if (typeof message === 'string' && message.startsWith('U')) {
            // Nếu dữ liệu là Base64, thử giải mã
            decodedMessage = Buffer.from(message, 'base64').toString('utf-8');
        } else {
            decodedMessage = message;
        }

        const command = JSON.parse(decodedMessage);
        console.log('Received command:', command);
    } catch (error) {
        console.log(`[Error][INTERNAL] ${error.message}`);
        ws.close();
    }
});

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
