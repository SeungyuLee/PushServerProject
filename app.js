var express = require('express');
var app = express();
app.locals.pretty = true;

app.set('view engine', 'ejs');
app.set('views', './views');

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true}));

var apn = require('apn'); // use node-apn module
var gcm = require('node-gcm'); // use node-gcm module

var mysql = require('mysql');
var conn = mysql.createConnection({
    host : 'localhost',
    user : 'root',
    password : 'qlslfqjagh',
    database : 'test1'
});
conn.connect(); // connect mysql database

var env = {
    and: new gcm.Sender('AIzaSyDCevIMeb9VQJnyzl_VRvmWOKQ9ua6EcvI'),
    ios: new apn.Provider({
        cert: "keys/cert.pem",
        key: "keys/key.pem"
    })
}; // it depends on your own GCM's API key, certificate and key for APNS

var send = {
    and: function(msg, device_token_arr, id) {
        var note = new gcm.Message({
            collapseKey: 'demo',
            delayWhileIdle: true,
            timeToLive: 3,
            data: {
                title: '',
                message: msg,
                customkey: id
            }
        });

        env.and.send(note, device_token_arr, 4, function(err, result) {
        });
    },
    ios: function(msg, device_token_arr, id) {
        var backgroundNote = new apn.Notification();
        backgroundNote.payload = { customKey : { first: { note_id: id }}};
        backgroundNote.payload = {
            customKey: {
                contentAv: "1"
            }
        };
        backgroundNote.title = id;
        backgroundNote.setContentAvailable(1);
        console.log(`Sending: ${backgroundNote.compile()}`); 
        // backgroundNote is for tracking sending feedback.
        // it does not appear on users' devices
        var note = new apn.Notification();
        note.payload = { customKey: {first: { note_id : id }}}
        note.alert = msg;
        note.sound = `default`;
        env.ios.send(backgroundNote, device_token_arr).then(result => {});
        env.ios.send(note, device_token_arr).then(result => {});
    }
}; // sends push notification to android and ios devices

(function() {
    var cycle = {
        scheduler: 999,
        feedwatch: 4999
    };

    var scheduler = function() {
        var fetch = 'SELECT * FROM `Message` WHERE (send_time < now()) AND (expire_time > now()) AND (done = 0);';

        conn.query(fetch, function(err, rows, fields) {
            if (err) console.log("DEBUG 1: " + err);
            else for (var r in rows) {
                var txt = rows[r].content;
                var target = rows[r].target;
                var id = rows[r].id;

                if (target.length === 64) send.ios(txt, [target], id);
                else if (target.length === 152) send.and(txt, [target], id);
                else {
                    send.and(txt, [target]);
                    console.log("WARNING: token length not 64 or 152");
                }

                if (rows[r]['repeat_freq'] !== 0) {
                    var update = "UPDATE Message SET send_time=DATE_ADD(now(), INTERVAL " + rows[r]['repeat_freq'] + " MINUTE) WHERE id=" + rows[r]['id'];
                } else {
                    var update = "UPDATE Message SET done=1 WHERE id=" + rows[r]['id'];
                }

                conn.query(update, function(err, rows, fields) { if (err) console.log("DEBUG 2: " + err); });
            }
        });
    };

    var feedwatch = function() {
        var sql = 'SELECT * FROM Message WHERE (send_time < now()) AND (send_stat = 0) AND (read_stat = 0) AND (expire_time > now())';

        conn.query(sql, function(err, rows, fields) {
            if (err) console.log("DEBUG 3: " + err);
            else for (var i in rows) {
                var sender;
                if (rows[i]['target'].length === 64) sender = send.ios;
                else sender = send.and;

                sender(rows[i]['content'], [rows[i]['target']], rows[i]['id']);
            }
        });

        var sql = 'SELECT * FROM Message WHERE (tracked = 0) AND (done = 1) AND (send_time < now()) AND (send_stat = 0) AND (read_stat = 0) AND (expire_time < now())';

        conn.query(sql, function(err, rows, fields) {
            if (err) console.log("DEBUG 20: " + err);
            else for (var i in rows) {
                var sql = 'UPDATE Message SET tracked=1 WHERE id=?';
                var id = rows[i]['id'];
                conn.query(sql, id, function(err, rows1, fields) { if (err) console.log("DEBUG 23: " + err); });
                
                var find = 'SELECT second_token FROM Device WHERE device_token=?';
                var target = rows[i]['target'];
                conn.query(find, target, function(err, rows2, fields) {
                    if (err) console.log("DEBUG 21: " + err);
                    else for (var j in rows2) {
                        var exec = 'INSERT INTO Message (content, target, send_time, repeat_freq, done, expire_time) VALUES(?, ?, now(), 0, 0, DATE_ADD(now(), INTERVAL 10 MINUTE))';
                        var input = [rows[i]['content'], rows2[j]['second_token']];

                        conn.query(exec, input, function(err, rows, fields) { if (err) console.log("DEBUG 22: " + err); });
                    }
                });
            }
        });
    };

    setInterval(scheduler, cycle.scheduler);
    setInterval(feedwatch, cycle.feedwatch);
}()); // set scheduler

app.post('/submit_feedback', function(req, res) {
    var id = req.body.id;
    var send_stat = req.body.send_stat;
    var read_stat = req.body.read_stat;

    var sql = "";
    var input = [];

    if (typeof send_stat !== "undefined") {
        sql = 'UPDATE Message SET send_stat=1 WHERE id=?';
        console.log("send feedback : "+ id + ", " + send_stat);
    } else if (typeof read_stat !== "undefined") {
        sql = 'UPDATE Message SET send_stat=1, read_stat=1 WHERE id=?';
        console.log("read feedback : "+ id + ", " + read_stat);
    } else {
        console.log("WARNING: feedback submit w/ neither send nor read stat");
        return;
    }
    input.push(id);

    conn.query(sql, input, function(err, rows, fields) {
        if (err) console.log("DEBUG 4: " + err);
    });

    res.send(req.body);
}); // get sending feedback and reading feedback from devices

app.post('/condi_push', function(req, res) {
    var token = req.body.device_token;
    var cond = req.body.condition;
    console.log("condi push content: " + token + ", " + cond);

    var send_f = (function() {
        if (token.length === 64) return send.ios;
        else return send.and;
    }());

    switch(cond) {
        case 'seoul':
            send_f("Namsan Tower Bulgogi Brothers", [token]);
            break;

        case 'busan':
            send_f("Busan Seagull Sukadpbab", [token]);
            break;
    }
}); // an example for push notification depending on certain condition(user's behaviour)

app.get('/stat', function(req, res) {
    var sql = "SELECT * FROM Message";
    conn.query(sql, function(err, rows, fields) {
        if (err) console.log("DEBUG 5: " + err);
        else res.render('stat', {
            messages: rows
        });
    });
});

app.post('/stat', function(req, res) {
    var mode = req.body.mode;
    var ids = JSON.parse(req.body.ids);

    if (mode === "discard") {
        for (var i in ids) {
            if (ids[i] === null) break;
            var sql = 'DELETE FROM Message WHERE id=?';
            var input = ids[i];

            conn.query(sql, input, function(err, rows, fields) { if (err) console.log("DEBUG 6: " + err); });
        }
    }else if (mode === "send") {
        for (var i in ids) {
            var sql = 'UPDATE Message SET done=0 WHERE id=?';
            var input = ids[i];

            conn.query(sql, input, function(err, rows, fields) { if (err) console.log("DEBUG 7: " + err); });
        }
    }

    res.redirect('/stat');
}); // stat page development

app.get('/admin', function(req, res) {
    var sql = "SELECT * FROM Device";
    conn.query(sql, function(err, rows, fields) {
        if (err) console.log("DEBUG 8: " + err);
        else res.render('admin', {
            devices: rows
        });
    });
});

app.post('/admin', function(req, res) {
    console.dir(req.body);
    var mode = req.body.mode;

    if (mode === "create") {
        var os = req.body.os;
        var token = req.body.token;
        var sql = 'INSERT INTO Device (os, device_token) VALUES(?, ?)';
        var input = [os, token];

        conn.query(sql, input, function(err, rows, fields) { if (err) console.log("DEBUG 9: " + err); });
    } else if (mode === "delete") {
        var tokens = JSON.parse(req.body.tokens);

        for (var i in tokens) {
            var sql = 'DELETE FROM Device WHERE device_token=?';
            var input = tokens[i];

            conn.query(sql, input, function(err, rows, fields) { if (err) console.log("DEBUG 10: " + err); });
        }
    } else if (mode === "send") {
        var content = req.body.message;
        var tokens = JSON.parse(req.body.tokens);
        var send_mins = parseInt(req.body.send_offset * req.body.send_time_scale);
        var expire_mins = send_mins + parseInt(req.body.expiry_date * req.body.expire_time_scale);
        var repeat_mins = parseInt(req.body.repeat_period * req.body.repeat_time_scale);

        for (var i in tokens) {
            if (tokens[i] === null) break;
            var sql = 'INSERT INTO Message (content, target, send_time, expire_time, repeat_freq, done) VALUES(?, ?, DATE_ADD(now(), INTERVAL ? MINUTE), DATE_ADD(now(), INTERVAL ? MINUTE), ?, 0)';
            var input = [content, [tokens[i]], send_mins, expire_mins, repeat_mins];

            conn.query(sql, input, function(err, rows, fields) { if (err) console.log("DEBUG 11: " + err); });
        }
    }

        res.redirect('/admin');
    }); // admin page development

    var server = app.listen(3000, function(){
        console.log('Connected on port ' + server.address().port);
    });
