module.exports = {
  apps: [
    {
      name: "gundam-next",
      cwd: "D:/aaaaaaaaaaa/gundam-next",
      script: "dist/bot.js", 
      interpreter: "C:/Program Files/nodejs/node.exe",
      node_args: ["-r", "dotenv/config"],
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
