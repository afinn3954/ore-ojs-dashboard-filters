const fs = require('fs');
const parser = require('php-parser');

const engine = new parser.Engine({
    parser: {
        extractDoc: true,
        suppressErrors: false,
        version: '8.3',
    },
    ast: {
        withPositions: true,
    },
});

const file = process.argv[2];
engine.parseCode(fs.readFileSync(file, 'utf8'), file);
console.log(`PHP syntax parsed successfully: ${file}`);
