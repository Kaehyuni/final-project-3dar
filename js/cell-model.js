import * as THREE from 'three';
// Independently authored schematic geometry. No downloaded meshes or textures.
export function buildCell(){
 const root=new THREE.Group(),parts=new Map(),targets=[];
 const palette={membrane:0x317d8e,cytoplasm:0xc2dcd7,nucleus:0x736b9f,nucleolus:0x4b3e79,chromatin:0xd6abd1,ribosomes:0x283f66,'rough-er':0x6e9bab,'smooth-er':0x75a998,golgi:0xd4a45d,mitochondria:0xc97851,lysosomes:0xa26e93,peroxisomes:0x7e9861,cytoskeleton:0xb28f71,vesicles:0x6babb8};
 for(const id of Object.keys(palette)){const group=new THREE.Group();group.userData.partId=id;parts.set(id,group);root.add(group)}
 function mat(id,extra={}){return new THREE.MeshStandardMaterial({color:palette[id],roughness:.72,metalness:0,...extra})}
 function mesh(id,geo,pos,scale=[1,1,1],extra={}){const m=new THREE.Mesh(geo,mat(id,extra));m.position.set(...pos);m.scale.set(...scale);m.userData.partId=id;parts.get(id).add(m);targets.push(m);return m}
 const sphere=new THREE.SphereGeometry(1,36,24);
 mesh('membrane',new THREE.SphereGeometry(2.6,64,40),[0,0,0],[1,.84,.8],{transparent:true,opacity:.46,side:THREE.DoubleSide,depthWrite:false,clippingPlanes:[new THREE.Plane(new THREE.Vector3(0,0,-1),0)]});
 mesh('cytoplasm',new THREE.SphereGeometry(2.53,48,32),[0,0,0],[1,.84,.8],{transparent:true,opacity:.1,depthWrite:false,side:THREE.BackSide});
 mesh('nucleus',sphere,[-.48,.25,.1],[.92,.82,.74],{transparent:true,opacity:.82});
 mesh('nucleolus',sphere,[-.55,.2,.73],[.27,.25,.22]);
 function tube(id,points,r=.045,color){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(id,new THREE.TubeGeometry(curve,48,r,7,false),[0,0,0],[1,1,1],color?{color}:{});}
 for(let k=0;k<4;k++){
  const points=[];for(let j=0;j<20;j++){const t=j/19*Math.PI*3;points.push([-.48+Math.cos(t+k)*(.33+k*.05),.25+Math.sin(t*1.3+k)*.4,.68+Math.cos(t*.7)*.08])}tube('chromatin',points,.021);
 }
 for(let k=0;k<5;k++){
  const pts=[];for(let j=0;j<18;j++){const t=j/17*Math.PI*1.5+.1;pts.push([-.45+Math.cos(t)*(1.02+k*.12),.17+Math.sin(t)*(.9+k*.085),.12+k*.065]);}
  tube('rough-er',pts,.075);
  for(let j=1;j<16;j+=3){const pos=pts[j];mesh('ribosomes',sphere,[pos[0],pos[1],pos[2]+.08],[.045,.045,.045])}
 }
 for(let k=0;k<5;k++){const pts=[];for(let j=0;j<14;j++){let t=j/13*Math.PI*1.4;pts.push([.62+Math.cos(t)*(.42+k*.04),-1.03+Math.sin(t)*.35,.2+k*.11])}tube('smooth-er',pts,.055)}
 for(let k=0;k<5;k++){const pts=[];for(let j=0;j<18;j++){let t=j/17;pts.push([.67+t*.96,.48+k*.17+Math.sin(t*Math.PI)*.14,.55+Math.sin(t*Math.PI)*.12])}tube('golgi',pts,.072)}
 for(const [x,y,z,rot] of [[1.5,-.55,.55,-.45],[-1.6,-.8,.37,.45],[1.4,1.18,-.3,.3]]){
  const m=mesh('mitochondria',sphere,[x,y,z],[.53,.28,.23]);m.rotation.z=rot;
  for(let k=0;k<5;k++){const t=-.3+k*.145;const pts=[[x+t*Math.cos(rot)-.12*Math.sin(rot),y+t*Math.sin(rot)+.12*Math.cos(rot),z+.15],[x+(t+.06)*Math.cos(rot)+.1*Math.sin(rot),y+(t+.06)*Math.sin(rot)-.1*Math.cos(rot),z+.19],[x+(t+.12)*Math.cos(rot)-.12*Math.sin(rot),y+(t+.12)*Math.sin(rot)+.12*Math.cos(rot),z+.15]];tube('mitochondria',pts,.022,0x824126)}
 }
 for(const pos of [[-1.7,.6,.7],[.3,-1.55,.8]])mesh('lysosomes',sphere,pos,[.22,.22,.22]);
 for(const pos of [[1.92,.2,.4],[-.9,-1.45,.25]]){mesh('peroxisomes',sphere,pos,[.18,.18,.18]);mesh('peroxisomes',new THREE.OctahedronGeometry(.09),[pos[0],pos[1],pos[2]+.16])}
 for(const pos of [[1.9,1,.45],[1.8,.88,.7],[.8,1.6,.3]])mesh('vesicles',sphere,pos,[.12,.12,.12]);
 for(let i=0;i<26;i++){const t=i*2.399;const r=1.2+(i%5)*.15;const x=Math.cos(t)*r,y=Math.sin(t)*r*.75;if(x>-.3&&x<.5&&y>.1)continue;mesh('ribosomes',sphere,[x,y,.65],[.045,.045,.045])}
 for(let k=0;k<7;k++){const a=k/7*Math.PI*2;const pts=[];for(let j=0;j<8;j++){const t=j/7;pts.push([Math.cos(a)*2.15*(1-t)+Math.cos(a+1)*1.9*t,Math.sin(a)*1.7*(1-t)+Math.sin(a+1)*1.5*t,-.7+Math.sin(t*Math.PI)*.15])}tube('cytoskeleton',pts,.028)}
 const marks=new THREE.Group();root.add(marks);
 function select(id,isolate=false){for(const [key,g] of parts){g.visible=!isolate||key===id;g.traverse(o=>{if(o.isMesh){o.material.emissive.set(key===id?0x222b40:0);o.material.emissiveIntensity=key===id?.35:0}})}}
 function cutaway(value){for(const m of parts.get('membrane').children)m.material.clippingPlanes=value?[new THREE.Plane(new THREE.Vector3(0,0,-1),0)]:[]}
 function updateClipping(){root.updateMatrixWorld(true);for(const m of parts.get('membrane').children)if(m.material.clippingPlanes?.length)m.material.clippingPlanes[0].copy(new THREE.Plane(new THREE.Vector3(0,0,-1),0)).applyMatrix4(root.matrixWorld)}
 return {root,parts,targets,marks,select,cutaway,updateClipping};
}
