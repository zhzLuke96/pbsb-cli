process.on("message", (req) => {
  process.send({
    recv_id: req.recv_id,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
    body: "<h1>hello pubsub host</h1>",
  });
});
