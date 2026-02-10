var n=t=>a=>{let r=t.safeParse(a);if(r.success)return{};let e={};for(let o of r.error.issues){let s=o.path[0];s&&(e[s]=o.message)}return e};export{n as zodResolver};
