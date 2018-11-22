// example import asset
// import imgPath from './assets/img.jpg';

// TODO : add Dat.GUI
// TODO : add Stats

import 'three/examples/js/postprocessing/EffectComposer';
import 'three/examples/js/postprocessing/RenderPass';
import 'three/examples/js/postprocessing/ShaderPass';
import 'three/examples/js/shaders/CopyShader'

import 'three/examples/js/shaders/DotScreenShader'
import 'three/examples/js/shaders/LuminosityHighPassShader';
import 'three/examples/js/postprocessing/UnrealBloomPass';

import Sound from './Sound'

var speed = 0;
var sinTimer  = 0;
var sinVal = 0;
var sinAmplitude  = 0;
var nbsin = 3;

var musicStarted = false;

var clock = new THREE.Clock();
var delta = 0;
export default class App {

    constructor() {
        this.container = document.querySelector( '#main' );
        document.body.appendChild( this.container );
        
        this.soundController = new SoundController();
        
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
    	this.renderer.setPixelRatio( window.devicePixelRatio );
    	this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.container.appendChild( this.renderer.domElement );

        this.camera = new THREE.PerspectiveCamera( 120, window.innerWidth / window.innerHeight, 0.05, 1000 );
        this.camera.position.z = 1;
        this.camera.position.x = 0;
        this.camera.position.y = 0.5;

        this.scene = new THREE.Scene();

        this.composer = new THREE.EffectComposer( this.renderer );
        this.composer.setSize( window.innerWidth, window.innerHeight );
        let renderPass = new THREE.RenderPass(this.scene,this.camera);
        this.composer.addPass(renderPass);

        var params = {
            exposure: 1,
            bloomStrength: 3,
            bloomThreshold: 0.2,
            bloomRadius: 0.8
        };

        var bloomPass = new THREE.UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
        bloomPass.exposure = params.exposure;
        bloomPass.threshold = params.bloomThreshold;
        bloomPass.strength = params.bloomStrength;
        bloomPass.radius = params.bloomRadius;

        this.composer.addPass( bloomPass );

        //IMPORTANT
        var copyPass = new THREE.ShaderPass(THREE.CopyShader);
        copyPass.renderToScreen = true;
        this.composer.addPass(copyPass);

        this.buildings = new Array();

        this.scene.fog = new THREE.Fog(0x281540,0,220);
        this.scene.background = new THREE.Color(0x281540);

       


        for(let i = 0;i<50;i++){
            let building = new Building(getRandomPosX(),Math.random() * - 250,this.scene);
            this.buildings.push(building);
            building.genFloors();
        }


        this.car = new Car(this.scene,this.camera);
        this.road = new Road(this.scene,this.renderer);
    
        this.soundController.simpleBeat.set({
            onBeat: ()=>{
                sinTimer = 0;
                sinVal = 0;
            }
        });
        this.soundController.simpleBeat.on();

    	window.addEventListener('resize', this.onWindowResize.bind(this), false);
        this.onWindowResize();

        this.renderer.animate( this.render.bind(this) );
    }

    render() {
        let time = Date.now()/1000;
        delta = clock.getDelta();

        for(let i = 0;i<this.buildings.length;i++){
            this.buildings[i].update();
            if(this.buildings[i].group.position.z > this.camera.position.z){
                this.scene.remove(this.buildings[i].group);
                this.buildings.splice(i,1);
                let build = new Building(getRandomPosX(),-250 ,this.scene);
                this.buildings.push(build);
                build.genFloors();
            }
        }
        if(this.materialShader != null){
            this.materialShader.uniforms.time.value = time;
        }

       // sinTimer -= Math.PI * 2  * 90/60 * clock.getDelta();

        let duration = 90/60;
        sinVal = easeOutExpo(sinTimer,0 ,Math.PI * 2,duration);
        if(sinTimer < duration)
        sinTimer += delta;
        this.car.update();
        this.road.update();

        this.composer.render();
    
    }

    onWindowResize() {

    	this.camera.aspect = window.innerWidth / window.innerHeight;
    	this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.composer.setSize( window.innerWidth, window.innerHeight );
    }
}

class Road{
    constructor(scene,renderer){
        let texture = new THREE.TextureLoader().load("/grid.jpg");
        texture.userData = {
            fitTo : 1.66
        };
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = renderer.getMaxAnisotropy();

        texture.magFilter = THREE.NearestFilter;
        
        this.geometry = new THREE.PlaneGeometry( 5, 250,1,250);
        this.material = new THREE.MeshBasicMaterial
        ({ 
            color: 0xffcc00,
            map : texture,
        });

        this.road = new THREE.Mesh(this.geometry,this.material);
        meshFitUvMap(this.road);
        this.road.rotation.set(-Math.PI/2,0,0);
        this.road.position.set(0,49,-125);
        scene.add(this.road);

        for(let i = 0;i<this.geometry.vertices.length;i++){
            this.geometry.vertices[i]._z = this.geometry.vertices[i].z;
            this.geometry.vertices[i]._sin = Math.PI * 2 * ((this.geometry.vertices[i].y + 125)/250) * nbsin;
        }
    }

    update(){
        this.material.map.offset.y += 0.1 * speed;

        for(let i = 0;i<this.geometry.vertices.length;i++){
            let value = this.geometry.vertices[i]._sin + sinVal;
            this.geometry.vertices[i].z = this.geometry.vertices[i]._z + Math.sin(value) * sinAmplitude;
        }
        this.geometry.verticesNeedUpdate = true;
    }
}

class Car{
    constructor(scene,camera){
        this.inputs = new InputManager();
        let g =  new THREE.BoxGeometry(0.2,0.1,0.5);
        let  m = new THREE.MeshBasicMaterial({color:0x4d4d4d});
        this.mesh = new THREE.Mesh(g,m);
        this.mesh.position.set(0,49.5,-5);
        scene.add(this.mesh);
        this.mesh.add(camera);
        this.momentum = 0;

        this.sin = Math.PI * 2 * (this.mesh.position.z/-250) * nbsin;
        console.log("car",this.sin);
    }

    update(){
        if(this.inputs.getKey(37)){
            this.momentum = clamp(this.momentum - 100 * delta,-10,10);
        }else if(this.inputs.getKey(39)){
            this.momentum = clamp(this.momentum + 100 * delta,-10,10);
        }else{
            this.momentum -= this.momentum * 0.2;
        }
        console.log(this.momentum);

        this.mesh.position.x = clamp(this.mesh.position.x + this.momentum * delta,-2.3,2.3);

        this.mesh.position.y = 49 + Math.sin(this.sin + sinVal) * sinAmplitude;
    }
}

class Building{
    constructor(x,y,scene){
        this.group = new THREE.Group(); 
        this.group.position.set(x,0,y);
        this.height = 0;
        this.rotspeed = 0.2 * Math.random() - 0.1;
        scene.add(this.group);

        let texture = new THREE.TextureLoader().load("/window.jpg");
        texture.userData = {
            fitTo : 0.5
        };
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.NearestFilter;

        this.material = new THREE.MeshBasicMaterial
        ({ 
            color: 0xff0000,
            map : texture,
        });
    }

    update(){
        this.group.rotation.y += this.rotspeed;
        this.group.position.z += 1 * speed;
    }

    addFloor(){
        let h = Math.random() * 7 + 5;
        let w = Math.random() * 10 + 10
        let g =  new THREE.BoxGeometry( w,h,w);
        let floor = new THREE.Mesh( g, this.material );
       // meshFitUvMap(floor);
        floor.position.set(Math.random() * 4 - 2,this.height + h/2,Math.random() * 4 - 2);
        floor.rotation.y = Math.PI * 2 * Math.random();
        this.group.add(floor);

        this.height += h;
    }

    genFloors(){
        let nb = getRandomInt(10,30);
        for(let i = 0;i<nb;i++)
            this.addFloor();
    }
}



function getRandomPosX(){
    return (Math.random() * 90 + 15) * Math.sign(Math.random() - 0.5);
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

class InputManager{
    constructor(){
        this.keys = new Array();

        document.onkeydown = (e) => {
            this.removeKey(e.keyCode);
            this.keys.push(e.keyCode);
        };

        document.onkeyup = (e) => {
            this.removeKey(e.keyCode);
        };
    }

    getKey(key){
        for(let i = 0; i < this.keys.length; i++){
            if(this.keys[i] == key){
                return true;
            }
        }
        return false;
    }

    removeKey(key){
        for(let i = 0; i < this.keys.length; i++){
            if(this.keys[i] == key){
               this.keys.splice(i,1);
            }
        }
    }
}

function meshFitUvMap(mesh) {
  
    if (mesh.geometry && 
        mesh.material && 
        mesh.material.map && 
        mesh.material.map.userData && 
        mesh.material.map.userData.fitTo > 0) {
      
        
       var geometry = mesh.geometry;
       var textureFitTo = mesh.material.map.userData.fitTo; 
       var faces = mesh.geometry.faces;
      
        for (var i = 0, len = faces.length; i < len; i ++) {
        var face = faces[i];
        var uv = geometry.faceVertexUvs[0][i];
 
        var components = ['x', 'y', 'z'].sort(function(a, b) {
           return Math.abs(face.normal[a]) > Math.abs(face.normal[b]);
        });
      
      var v1 = mesh.geometry.vertices[face.a];
      var v2 = mesh.geometry.vertices[face.b];
      var v3 = mesh.geometry.vertices[face.c];
      
      var newUv0 = new THREE.Vector2(v1[components[0]] / textureFitTo, v1[components[1]] / textureFitTo);
      var newUv1 = new THREE.Vector2(v2[components[0]] / textureFitTo, v2[components[1]] / textureFitTo);
      var newUv2 = new THREE.Vector2(v3[components[0]] / textureFitTo, v3[components[1]] / textureFitTo);
 
        uv[0].copy(newUv0);
        uv[1].copy(newUv1);
        uv[2].copy(newUv2);
 
        }
    }
 }

 class SoundController {
    constructor() {
        this.music = new Sound('/hyper-spoiler.wav', 90, 0, () => {
            this.playSound();
            this.ctx.time = 10;
        }, false);


        this.simpleBeat = this.music.createBeat({});

        /*this.kick = this.music.createKick({
            onKick: (mag) => {
                console.log('Kick!');
            },
            offKick: function (mag) {
                console.log('no kick :(');
            }
        });

        this.simpleBeat = this.music.createBeat({});

        this.introHighKick = this.music.createKick({});

        this.lowDrop = this.music.createKick({});

        this.highDrop = this.music.createKick({});
        */

        this.music.onceAt("test",3.5, function () {
            sinAmplitude = 1;
            speed = 0.2;
        }).after("test",24, function () {
            
            sinAmplitude = 3;
            speed = 1;
            setTimeout(function(){
                window.app.camera.fov = 130;
                window.app.camera.updateProjectionMatrix();
            },0.5);
        })

    }

    playSound() {
        this.music.play();
    }
}

function easeOutExpo ( t, b, c, d) {
    return c*((t=t/d-1)*t*t + 1) + b;
}

function clamp(val,min,max){
    if(val < min)
        return min;
    else if(val > max)
        return max;
    else
        return val;
}