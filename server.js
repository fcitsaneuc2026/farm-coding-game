const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 创建数据库
const db = new sqlite3.Database(path.join(__dirname, 'harvestit.db'));

// 创建表
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        score INTEGER NOT NULL,
        goal INTEGER NOT NULL,
        completed INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // 创建索引提高查询速度
    db.run('CREATE INDEX IF NOT EXISTS idx_score ON records(score DESC)');
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Harvest IT Server is running' });
});

// 提交成绩
app.post('/api/submit', (req, res) => {
    const { name, score, goal, completed } = req.body;
    
    // 验证数据
    if (typeof score !== 'number' || score < 0) {
        return res.status(400).json({ error: 'Invalid score' });
    }
    
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Name is required' });
    }
    
    db.run(
        'INSERT INTO records (name, score, goal, completed) VALUES (?, ?, ?, ?)',
        [name.trim().substring(0, 50), score, goal || 500, completed ? 1 : 0],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to save record' });
            }
            console.log(`✅ 新成绩: ${name} - ${score} 金币 (${completed ? '完成' : '未完成'})`);
            res.json({ 
                id: this.lastID, 
                message: '成绩已记录',
                rank: null
            });
        }
    );
});

// 获取排行榜
app.get('/api/leaderboard', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    
    db.all(
        'SELECT id, name, score, goal, completed, timestamp FROM records ORDER BY score DESC LIMIT ?',
        [limit],
        (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to fetch leaderboard' });
            }
            res.json(rows);
        }
    );
});

// 获取统计信息
app.get('/api/stats', (req, res) => {
    db.get(
        `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
            ROUND(AVG(score), 2) as avgScore,
            MAX(score) as maxScore,
            MIN(score) as minScore
        FROM records`,
        [],
        (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to fetch stats' });
            }
            res.json(row || { total: 0, completed: 0, avgScore: 0, maxScore: 0, minScore: 0 });
        }
    );
});

// 获取个人最佳成绩
app.get('/api/personal-best/:name', (req, res) => {
    const name = req.params.name;
    
    db.get(
        'SELECT * FROM records WHERE name = ? ORDER BY score DESC LIMIT 1',
        [name],
        (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to fetch personal best' });
            }
            res.json(row || null);
        }
    );
});

// 启动服务器
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // 监听所有网络接口

app.listen(PORT, HOST, () => {
    console.log(`🚀 Harvest IT Server running on http://${HOST}:${PORT}`);
    console.log(`📊 API endpoints:`);
    console.log(`   GET  /api/health - 健康检查`);
    console.log(`   POST /api/submit - 提交成绩`);
    console.log(`   GET  /api/leaderboard - 获取排行榜`);
    console.log(`   GET  /api/stats - 获取统计信息`);
    console.log(`   GET  /api/personal-best/:name - 获取个人最佳成绩`);
    console.log(`\n💡 提示：确保防火墙允许端口 ${PORT}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing database...');
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received, closing database...');
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});



