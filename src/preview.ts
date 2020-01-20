import path from 'path';
import express from 'express';

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', express.static(path.join(__dirname, '../generated')));

app.listen(port, () => console.log(`Preview is live, go to: http://localhost:${port}`));
