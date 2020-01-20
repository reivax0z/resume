import fs from 'fs';
const fsPromises = fs.promises;
import path from 'path';
import rimraf from 'rimraf';
import Handlebars from 'handlebars';
import marked from 'marked';

function setup() {
    rimraf.sync(path.resolve(__dirname, '../generated'));
    fs.mkdirSync(path.resolve(__dirname, '../generated'));
}

async function generateHtmlFiles() {
    const htmlTemplate = await fsPromises.readFile(
        path.resolve(__dirname, '../templates/template.hbs'), { encoding: 'utf8' }
    );

    fs.readdirSync(path.resolve(__dirname, '../data')).forEach(async (file) => {

        const template = Handlebars.compile(htmlTemplate);
        const contentMd = await fsPromises.readFile(
            path.resolve(__dirname, '../data', file), { encoding: 'utf8' }
        );
        const contentHtml = marked(contentMd);

        await fsPromises.writeFile(
            path.resolve(__dirname, `../generated/${file.replace('.md', '.html')}`), 
            template({ content: contentHtml })
        );
        console.log(`handled file: ${file}`);
    });
}

async function renderHtml(data: string, templatefile: string) {
    const htmlTemplate = await fsPromises.readFile(
        path.resolve(__dirname, `../templates/${templatefile}`), { encoding: 'utf8' }
    );

    const template = Handlebars.compile(htmlTemplate);

    return template({ data });
}

async function generateIndex() {
    const htmlTemplate = await fsPromises.readFile(
        path.resolve(__dirname, '../templates/index.hbs'), { encoding: 'utf8' }
    );

    const entries = fs.readdirSync(path.resolve(__dirname, '../data')).map((file: string) => file.replace('.md', ''));
    const template = Handlebars.compile(htmlTemplate);
    
    await fsPromises.writeFile(
        path.resolve(__dirname, '../generated/index.html'), 
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
        path.resolve(__dirname, '../generated/github-markdown.css')
    );
}

export {
    generateHtmlFiles,
    generateIndex,
    copyGithubStyle,
    copyResumeToRoot,
    renderHtml,
    setup,
}