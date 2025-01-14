// 引入模块
const express = require('express');
const path = require('path');
const ejs = require('ejs');
//引入body-parser用于解析post的body
const bodyParser = require('body-parser');
//
const { spawn } = require('child_process');
//加载xml
const xml2js = require('xml-js');
const fs = require('fs');

const app = express();

// create application/json parser
const jsonParser = bodyParser.json();
// create application/x-www-form-urlencoded parser
const urlencodedParser = bodyParser.urlencoded({ extended: false });

/*
app.post('/login', urlencodedParser, function (req, res) {
    res.send('welcome, ' + req.body.username)
})
*/

app.post('/loadConfig', jsonParser, function (req, res) {
    if (!req.body) {
        return res.sendStatus(400);
    }
    let reqBody = req.body;
    console.log('/loadConfig: \nreqBody: ', reqBody);
    //读取路径配置文件
    let pathConfigFileName = path.join(__dirname, 'pathconfig.json');
    fs.readFile(pathConfigFileName, 'utf-8', function (err, data) {
        if (err) {
            return res.send('配置文件读取失败！');
        }
        //将json转化为js对象
        let config = JSON.parse(data);
        //通过key获取对象的value：若key是变量，则只能使用obj[key]；
        //若key是唯一固定值，则可以使用obj['key']或obj.key。
        //获取初始化文件路径
        let initloadFileName = config[reqBody.simType]['initConfigFileName'];
        //加载xml并解析为json
        let xml = fs.readFileSync(initloadFileName, 'utf-8');
        let options = { compact: true, ignoreComment: true };
        let result = xml2js.xml2js(xml, options);
        console.log('result:', result);
        res.json(result);
        console.log('---------------');
    });
})



//上传配置的同时调用python
app.post('/uploadConfig', jsonParser, function (req, res) {
    if (!req.body) {
        return res.sendStatus(400);
    }
    let reqBody = req.body;
    console.log('/uploadConfig: \nreqBody: ', reqBody);
    //将json转化为xml并写文件
    let options = { compact: true, ignoreComment: true, spaces: 4 };
    let xml = xml2js.json2xml(reqBody.jsonObj, options);
    //读取路径配置文件
    let pathConfigFileName = path.join(__dirname, 'pathconfig.json');
    fs.readFile(pathConfigFileName, 'utf-8', function (err, data) {
        if (err) {
            return res.send('配置文件读取失败！');
        }
        //将json转化为js对象
        let config = JSON.parse(data);
        //通过key获取对象的value：若key是变量，则只能使用obj[key]；
        //若key是唯一固定值，则可以使用obj['key']或obj.key。
        //获取上传配置文件所在目录
        let uploadFileDirectory = config[reqBody.simType]['uploadFileDirectory'];
        //获取python脚本路径
        let callPythonFileName = config[reqBody.simType]['callPythonFileName'];
        //设置上传配置文件的文件名
        let uploadFileName = uploadFileDirectory +
            new Date().getFullYear() + (new Date().getMonth() + 1) + new Date().getDate() + '_' +
            new Date().getTime() + 'username' + '.xml';
        //写上传配置文件
        fs.writeFile(uploadFileName, xml, (err) => {
            if (err) {
                return console.error(err);
            }
            //如果写成功则调用对应python脚本
            //spawn第二个参数是一个数组（array[0]:python脚本路径，array[1]:接受的第一个参数）
            let resLoadFileName;
            const callPython = spawn('python', [callPythonFileName, uploadFileName]);
            callPython.stdout.on('data', function (data) {
                //当脚本在控制台打印内容并返回收集输出数据的缓冲区时，将发出此事件
                //为了将缓冲区数据转换为可读形式，使用了toString()。
                resLoadFileName = data.toString();
            });
            callPython.on('close', (code) => {
                //当子进程的stdio流已关闭时，发出'close'事件，
                //此时再将所有数据传给浏览器
                console.log(`child process close all stdio with code ${code}`);
                console.log('resLoadFileName: ', resLoadFileName);
                //加载模拟返回的xml并解析为json
                fs.readFile(resLoadFileName, 'utf-8', function (err, data) {
                    if (err) {
                        return res.send('配置文件读取失败！');
                    }
                    let xml = data;
                    let options = { compact: true, ignoreComment: true };
                    let result = xml2js.xml2js(xml, options);
                    console.log('result:', result);
                    res.json(result);
                    console.log('---------------');
                });
            });
        });
    });
})

//引入multer
const multer = require('multer');
const { resolve, parse } = require('path');

const storage = multer.diskStorage({
    // destination:'public/uploads/'+new Date().getFullYear() + (new Date().getMonth()+1) + new Date().getDate(),
    destination: './uploads/' + new Date().getFullYear() + (new Date().getMonth() + 1) + new Date().getDate(),
    filename(req, file, cb) {
        const filenameArr = file.originalname.split('.');
        cb(null, Date.now() + '.' + filenameArr[filenameArr.length - 1]);
    }
});

const upload = multer({ storage });

app.use('/upload', upload.any());
//在req.files中获取文件数据
app.post('/upload', function (req, res) {
    /*
    const path = '/home/cenyc/Sources/Physika-web/'+req.files[0].path
    const execSync = require('child_process').execSync;
    const output = execSync('cd /home/cenyc/Sources/PhysIKA/build/bin/Release && python app_elasticity.py -p '+path)
    console.log('sync: ' + 'cd /home/cenyc/Sources/PhysIKA/build/bin/Release && python app_elasticity.py -p '+path)
    */
    res.send('上传成功')
})
/*
app.get('/python', function (req, res) {
    const execSync = require('child_process').execSync;

    const output = execSync('python src/test.py')
    console.log('sync: ' + output.toString())
    console.log('over')
    res.send('sync: ' + output.toString());
});
*/
// 设置views路径和模板
app.set('views', './static/view');
//模板采用html作为扩展名
app.set('view engine', 'html');
//对于以html扩展名结尾的模板，采用ejs引擎
app.engine('html', ejs.renderFile);

// app.use配置
//把static设置为静态资源文件夹，可以让浏览器访问
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/dist', express.static(path.join(__dirname, 'dist')));
//2020.10.8 新建data文件夹，包含配置文件和可视化数据
app.use('/data', express.static(path.join(__dirname, 'data')));

// 对所有(/)URL或路由返回index.html
app.get('/', function (req, res) {
    console.log('index...');
    res.render('index');
});

// 启动一个服务，监听从8888端口进入的所有连接请求
var server = app.listen(8888, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Listening at http://localhost:%s', port);
});