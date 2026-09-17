import {inspectMediaJournal} from './pdd-media-journal-read.mjs'
const [directory,...extra]=process.argv.slice(2)
if(!directory||extra.length)throw new Error('用法：npm run pdd:inspect-media-task -- <任务目录>；只读，不重试')
try{const result=await inspectMediaJournal(directory);console.log(JSON.stringify(result,null,2));if(result.status!=='recorded')process.exitCode=2}catch(error){console.error(error.message);process.exitCode=2}
