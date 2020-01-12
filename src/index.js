const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const rimraf = require('rimraf');
const Handlebars = require('handlebars');
const marked = require('marked');

function setup() {
    rimraf.sync(path.resolve(__dirname, '../out'));
    fs.mkdirSync(path.resolve(__dirname, '../out'));
}

async function generateHtmlFiles() {
    const htmlTemplate = await fsPromises.readFile(
        path.resolve(__dirname, './template/template.hbs'), { encoding: 'utf8' }
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

async function generateIndex() {
    const htmlTemplate = await fsPromises.readFile(
        path.resolve(__dirname, './template/index.hbs'), { encoding: 'utf8' }
    );

    const entries = fs.readdirSync(path.resolve(__dirname, '../data')).map((file) => file.replace('.md', ''));
    const template = Handlebars.compile(htmlTemplate);
    
    await fsPromises.writeFile(
        path.resolve(__dirname, '../out/index.html'), 
        template({ entries })
    );
    console.log('generated index file');
}

async function copyResumeToRoot() {
    await fsPromises.copyFile(
        path.resolve(__dirname, '../data/resume.md'),
        path.resolve(__dirname, '../README.md')
    );
}

async function copyGithubStyle() {
    await fsPromises.copyFile(
        path.resolve(__dirname, '../node_modules/github-markdown-css/github-markdown.css'),
        path.resolve(__dirname, '../out/github-markdown.css')
    );
}

(async function main() {
    try {
        setup();
        Promise.all([
            await copyGithubStyle(),
            await generateHtmlFiles(),
            await generateIndex(),
            await copyResumeToRoot(),
        ]);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
