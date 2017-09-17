import * as express from 'express';
import { q, SQLiteDriver } from 'konstellio-db';

const app = express();
const db = new SQLiteDriver({
    filename: 'F:\\Apps\\konstellio\\sculptor-project\\sculptor.sqlite'
});

db.connect();

interface page {
    id: number
    parent?: number
    seq: number
    lft: number
    rgt: number
}

app.get('/', async (req, res) => {
    res.set('Content-Type', 'text/plain');
    try {
        let entry = await db.execute<page>(q.select().from('entry_page').eq('id', 2));
        let page = entry.results[0];
        let children = await db.execute<page>(q.select().from('entry_page').where(q.and(q.gte('lft', page.lft), q.lte('rgt', page.rgt))));
        res.send(`${JSON.stringify(children.results)}`);
    } catch (err) {
        res.send(`${err.stack}`);
    }
});

app.listen(8080, () => {
    console.log(`Server listening to ...`);
});