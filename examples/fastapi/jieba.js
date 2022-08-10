const nodejieba = require("nodejieba");


// body like this
// {
//     "type": "cut",
//     "text": "南京市长江大桥" 
// }

const recv = (result) => process.send({result});

process.on('message', data => {
    const {body} = data;
    const {type = 'cut', text, args = [10]} = body || {};
    if (typeof text !== 'string') {
        process.send({message: 'text required, but empty'});
        return;
    }
    switch(type) {
        case 'cut': return recv(nodejieba.cut(text));
        case 'extract': return recv(nodejieba.extract(text, ...args));
        case 'rank': return recv(nodejieba.textRankExtract(text, ...args));
        case 'tag': return recv(nodejieba.tag(text));
    }
    return recv(nodejieba.cut(text));
});

