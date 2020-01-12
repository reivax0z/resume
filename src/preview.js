const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const Handlebars = require('handlebars');
const express = require('express');

const app = express();
const port = 3000;

app.use('/', express.static(path.join(__dirname, '../out')));

app.listen(port, () => console.log(`Preview is live, go to: http://localhost:${port}`))
