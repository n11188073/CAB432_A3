// loadtest.js
(async () => {
  const loadtest = await import("loadtest");

  const SERVER_URL = "http://ec2-3-27-56-108.ap-southeast-2.compute.amazonaws.com:8080/";

  const options = {
    url: SERVER_URL,
    maxRequests: 1000,   // Increase for longer test
    concurrency: 50,     // Start with 50, adjust as needed
    method: "GET"
  };

  loadtest.default.loadTest(options, (err, result) => {
    if (err) {
      return console.error("Error during test:", err);
    }
    console.log("Load test finished.");
    console.log(result);
  });
})();
