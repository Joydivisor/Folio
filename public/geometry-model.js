export const SHAPES={tetrahedron:[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]],cube:Array.from({length:8},(_,i)=>[i&1?1:-1,i&2?1:-1,i&4?1:-1]),octahedron:[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]};
const FACES={tetrahedron:[[0,1,2],[0,3,1],[0,2,3],[1,3,2]],cube:[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]],octahedron:[[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]]};
export function validateMesh(vertices,faces){
 if(!Array.isArray(vertices)||vertices.length<3||vertices.length>128||vertices.some(v=>!Array.isArray(v)||v.length!==3||v.some(x=>!Number.isFinite(x)||Math.abs(x)>100))||!Array.isArray(faces)||!faces.length||faces.length>256)throw Error('Invalid mesh: use 3–128 vertices and 1–256 faces');
 if(Math.max(...vertices.map(v=>Math.hypot(...v)))<1e-6)throw Error('Empty mesh');
 for(const f of faces){if(!Array.isArray(f)||f.length<3||f.length>8||new Set(f).size!==f.length||f.some(i=>!Number.isInteger(i)||i<0||i>=vertices.length))throw Error('Invalid face indices');const a=vertices[f[0]],b=vertices[f[1]].map((x,k)=>x-a[k]);if(!f.slice(2).some(i=>{const c=vertices[i].map((x,k)=>x-a[k]);return Math.hypot(b[1]*c[2]-b[2]*c[1],b[2]*c[0]-b[0]*c[2],b[0]*c[1]-b[1]*c[0])>1e-8;}))throw Error('Degenerate face');}
 return {vertices:structuredClone(vertices),faces:structuredClone(faces)};
}
export function geometryMesh(plan){
 if(plan.shape==='mesh')return validateMesh(plan.vertices,plan.faces);
 if(SHAPES[plan.shape])return {vertices:structuredClone(SHAPES[plan.shape]),faces:structuredClone(FACES[plan.shape])};
 const vertices=[],faces=[],n=16;
 const ring=(z,r)=>{const start=vertices.length;for(let i=0;i<n;i++){const a=i*2*Math.PI/n;vertices.push([r*Math.cos(a),r*Math.sin(a),z]);}return start;};
 if(plan.shape==='sphere'){vertices.push([0,0,1]);for(let j=1;j<8;j++)ring(Math.cos(j*Math.PI/8),Math.sin(j*Math.PI/8));const end=vertices.length;vertices.push([0,0,-1]);for(let i=0;i<n;i++){faces.push([0,1+i,1+(i+1)%n],[end,1+6*n+(i+1)%n,1+6*n+i]);for(let j=0;j<6;j++){const a=1+j*n,b=a+n;faces.push([a+i,b+i,b+(i+1)%n,a+(i+1)%n]);}}}
 else if(['cylinder','cone'].includes(plan.shape)){ring(-1,1);const bottom=vertices.length;vertices.push([0,0,-1]);const top=plan.shape==='cone'?vertices.push([0,0,1])-1:ring(1,1);const center=plan.shape==='cylinder'?vertices.push([0,0,1])-1:top;for(let i=0;i<n;i++){const next=(i+1)%n;faces.push([bottom,next,i]);if(plan.shape==='cone')faces.push([i,next,top]);else faces.push([i,next,top+next,top+i],[center,top+i,top+next]);}}
 else throw Error('Unsupported shape');
 return {vertices,faces};
}
export function rigidPoints(original,points){return Array.isArray(points)&&points.length===original.length&&points.every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))&&points.every((v,i)=>Math.abs(Math.hypot(...v)-Math.hypot(...original[i]))<1e-6)&&original.every((a,i)=>original.every((b,j)=>Math.abs(Math.hypot(...a.map((x,k)=>x-b[k]))-Math.hypot(...points[i].map((x,k)=>x-points[j][k])))<1e-6));}
