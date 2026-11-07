export class TrinityAI {
  constructor(private env:any){}
  async callGPT(prompt:string){
    const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Authorization':`Bearer ${this.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:this.env.GPT_MODEL||'gpt-4o',messages:[{role:'user',content:prompt}]})})
    const j:any=await r.json(); if(!r.ok) throw new Error(JSON.stringify(j)); return j.choices[0].message.content
  }
  async callGemini(prompt:string){
    const model=this.env.GEMINI_MODEL||'gemini-1.5-flash'
    const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.env.GEMINI_API_KEY}`
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})})
    const txt=await r.text(); if(!r.ok) throw new Error(`Gemini ${r.status}: ${txt}`); const j:any=JSON.parse(txt); return j.candidates?.[0]?.content?.parts?.[0]?.text
  }
  async route(prompt:string,prefer:any){
    if(prefer==='gpt') return {provider:'gpt',text:await this.callGPT(prompt)}
    if(prefer==='gemini') return {provider:'gemini',text:await this.callGemini(prompt)}
    try{ return {provider:'gemini',text:await this.callGemini(prompt)} }catch(e:any){ return {provider:'gpt',text:await this.callGPT(prompt),fallback:e.message} }
  }
}
