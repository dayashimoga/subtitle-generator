/* subtitle-generator */
'use strict';
(function(){
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);
    if(typeof QU !== 'undefined') QU.init({ kofi: true, discover: true });
    
    let recognition,recording=false,srt=[],index=1;
    const rec=$('#recordBtn'),exp=$('#exportBtn'),log=$('#transcriptLog');
    const Sr=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(Sr){
        recognition=new Sr();recognition.continuous=true;recognition.interimResults=true;
        let startTime;
        function fTime(ms){if(ms<0)ms=0;const s=Math.floor(ms/1000);const m=Math.floor(s/60);const h=Math.floor(m/60);const ms2=ms%1000;return String(h).padStart(2,'0')+':'+String(m%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0')+','+String(ms2).padStart(3,'0');}
        recognition.onstart=()=>{startTime=Date.now();recording=true;rec.textContent='🛑 Stop';rec.style.background='#ef4444';};
        recognition.onresult=(e)=>{
            for(let i=e.resultIndex;i<e.results.length;i++){
                if(e.results[i].isFinal){
                    const text=e.results[i][0].transcript.trim();
                    const end=Date.now()-startTime;
                    const start=Math.max(0,end-2000);
                    srt.push({id:index++,start:fTime(start),end:fTime(end),text});
                    log.innerHTML+='<div style="border-left:3px solid #6366f1;padding:4px 8px;margin:4px 0;"><span style="color:#888;">'+fTime(start)+' → '+fTime(end)+'</span><br>'+text+'</div>';
                    log.scrollTop=log.scrollHeight;
                }
            }
        };
        recognition.onerror=(e)=>{console.log(e);if(e.error!=='no-speech')log.innerHTML+='<div style="color:#ef4444;">Error: '+e.error+'</div>';};
        recognition.onend=()=>{recording=false;rec.textContent='🎙️ Start Recording';rec.style.background='';};
        rec.onclick=()=>{recognition.lang=$('#langRec').value;recording?recognition.stop():recognition.start();};
        exp.onclick=()=>{
            if(srt.length===0)return alert('No subtitles to export');
            let content=srt.map(s=>s.id+'\n'+s.start+' --> '+s.end+'\n'+s.text+'\n').join('\n');
            const a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(content);a.download='subtitles.srt';a.click();
        };
        $('#clearBtn').addEventListener('click',()=>{srt=[];index=1;log.innerHTML='';});
    }else{log.innerHTML='<div style="color:#ef4444;padding:1rem;">Speech recognition is not supported in this browser. Please use Chrome or Edge.</div>';}

})();
