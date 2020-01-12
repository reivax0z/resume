const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const rimraf = require("rimraf");
const Handlebars = require("handlebars");
const marked = require('marked');
const githubMarkdownCss = require('generate-github-markdown-css');

function clean() {
    rimraf.sync(path.resolve(__dirname, '../out'));
}

async function generate() {
    fs.mkdirSync(path.resolve(__dirname, '../out'));

    const htmlTemplate = await fsPromises.readFile(
        path.resolve(__dirname, './template/template.hbs'), { encoding: 'utf8' }
    );

    const githubStyle = await githubMarkdownCss();

    await fsPromises.writeFile(
        path.resolve(__dirname, `../out/github-markdown.css`), 
        githubStyle,
        { encoding: 'utf8' }
    );

    fs.readdirSync(path.resolve(__dirname, '../data')).forEach(async (file) => {
        console.log(`handling file: ${file}`);

        const template = Handlebars.compile(htmlTemplate);
        const contentMd = await fsPromises.readFile(
            path.resolve(__dirname, '../data', file), { encoding: 'utf8' }
        );
        const contentHtml = marked(contentMd);

        await fsPromises.writeFile(
            path.resolve(__dirname, `../out/${file.replace('.md', '.html')}`), 
            template({ content: contentHtml })
        );
        console.log(`handled file: ${file}`);
    });
}

async function copyResumeToRoot() {
    await fsPromises.copyFile(
        path.resolve(__dirname, '../data/resume.md'),
        path.resolve(__dirname, '../README.md')
    );
}

(async function main() {
    clean();
    await generate();
    await copyResumeToRoot();
})();
