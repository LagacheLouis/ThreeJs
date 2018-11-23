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

import Sound from './Sound';

import 'three/examples/js/loaders/OBJLoader';

var speed = 0;
var sinTimer  = 0;
var sinVal = 0;
var sinAmplitude  = 0;
var nbsin = 3;

var rotationTimer = 0;
var rotationSpeed = 0;

var clock = new THREE.Clock();
var delta = 0;

var score = 0;

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
        this.camera.position.z = 0;
        this.camera.position.x = 0;
        this.camera.position.y = 51;

        this.scene = new THREE.Scene();

        this.composer = new THREE.EffectComposer( this.renderer );
        this.composer.setSize( window.innerWidth, window.innerHeight );
        let renderPass = new THREE.RenderPass(this.scene,this.camera);
        this.composer.addPass(renderPass);

        var params = {
            exposure: 1,
            bloomStrength: 3,
            bloomThreshold: 0.25,
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
        this.ground = new Ground(this.scene,this.renderer);

        this.obstacles = new Array();
    
        this.opacity = 0;

        this.soundController.simpleBeat.set({
            onBeat: ()=>{
                sinTimer = 0;
                sinVal = 0;
                rotationTimer = 0;
                this.obstacles.push(new Obstacle(this.scene));
            }
        });
        this.soundController.simpleBeat.on();

    	window.addEventListener('resize', this.onWindowResize.bind(this), false);
        this.onWindowResize();

        this.renderer.animate( this.render.bind(this) );
    }

    render() {
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

        for(let i = 0;i<this.obstacles.length;i++){
            this.obstacles[i].update();
        }

        let duration = 90/60;
        sinVal = easeOutExpo(sinTimer,0 ,Math.PI * 2,duration);
        if(sinTimer < duration)
            sinTimer += delta;



        rotationSpeed = easeOutExpo(sinTimer,1,-1,1.5);
        if(rotationTimer < 1.5)
            rotationTimer += delta;

        this.car.update();
        this.road.update(); 
        this.ground.update();

        score += 1000000/254 * delta;

        if(this.car.mesh != null){
            this.camera.position.set(this.car.mesh.position.x,this.car.mesh.position.y + 0.6,this.car.mesh.position.z + 1.2);
            for(let i =0;i<this.obstacles.length;i++){
                if(this.obstacles[i].mesh.position.z > 0){
                    this.scene.remove(this.obstacles[i].mesh);
                    this.obstacles.splice(i,1);
                }else if(this.obstacles[i].mesh.position.z > -20){
                    if(new THREE.Vector2(this.obstacles[i].mesh.position.x,this.obstacles[i].mesh.position.z).distanceTo(new THREE.Vector2(this.car.mesh.position.x,this.car.mesh.position.y)) < 1.3 ){
                        console.log("collision");
                        score *= 0.5;
                        this.opacity = 0.3;
                        this.soundController.music.lowpass.frequency.value = 50;
                        this.scene.remove(this.obstacles[i].mesh);
                        this.obstacles.splice(i,1);
                    }
                }
            }
        }
        document.getElementById("hit").style.opacity = this.opacity;
        this.opacity -= this.opacity * 0.02;
        this.soundController.music.lowpass.frequency.value += (5000 - this.soundController.music.lowpass.frequency.value) * 0.02;
        document.getElementById("score").textContent = parseInt(score);

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
            color: 0x00ccd1,
            map : texture,
        });

        this.road = new THREE.Mesh(this.geometry,this.material);
        meshFitUvMap(this.road);
        this.road.rotation.set(-Math.PI/2,0,0);
        this.road.position.set(0,0,-125);
        scene.add(this.road);

        for(let i = 0;i<this.geometry.vertices.length;i++){
            this.geometry.vertices[i]._z = this.geometry.vertices[i].z;
            this.geometry.vertices[i]._sin = Math.PI * 2 * ((this.geometry.vertices[i].y + 125)/250) * nbsin;
        }
    }

    update(){
        this.material.map.offset.y += 0.1 * speed * delta;

        for(let i = 0;i<this.geometry.vertices.length;i++){
            let value = this.geometry.vertices[i]._sin + sinVal;
            this.geometry.vertices[i].z = this.geometry.vertices[i]._z + Math.sin(value) * sinAmplitude;
        }
        this.geometry.verticesNeedUpdate = true;
    }
}

class Ground{
    constructor(scene, renderer){
        let texture = new THREE.TextureLoader().load("/grid.jpg");
        texture.userData = {
            fitTo : 10
        };
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = renderer.getMaxAnisotropy();

        texture.magFilter = THREE.NearestFilter;
        
        this.geometry = new THREE.PlaneGeometry(1000, 250,1,512);
        this.material = new THREE.MeshBasicMaterial
        ({ 
            color: 0xb000ff,
            map : texture,
        });

        this.mesh = new THREE.Mesh(this.geometry,this.material);
        meshFitUvMap(this.mesh);
        this.mesh.rotation.set(-Math.PI/2,0,0);
        this.mesh.position.set(0,-20,-125);
        scene.add(this.mesh);
    }

    update(){
        this.material.map.offset.y += 0.1 * speed * delta; 
    }
}

class Obstacle{
    constructor(scene){
        let g =  new THREE.BoxGeometry( 1.66,10,1.66);
        let m = new THREE.MeshBasicMaterial({color:0x000000});
        this.mesh = new THREE.Mesh( g, m );
        this.mesh.position.set(Math.random() * 5 - 2.5,0,-250)
        scene.add(this.mesh);
    }

    update(){
        this.mesh.position.z += 20 * delta;
    }
}

class Car{
    constructor(scene){
        var loader = new THREE.OBJLoader();

        loader.load('./car.obj',(obj)=>{
            obj.scale.set(0.02,0.02,0.02);
            obj.rotation.y = Math.PI;
            let texture = new THREE.TextureLoader().load("car.png");

            let mat = new THREE.MeshStandardMaterial({
                map: texture,
                roughness: .3, 
                metalness: 0.5

            });


            obj.traverse( function ( node ) {

                if ( node.isMesh ) node.material = mat;
        
            } );

            this.mesh = obj;
            scene.add(this.mesh);
            this.mesh.position.set(0,51,-5);

            let pointLight = new THREE.PointLight(0xff0000,2,10);
            this.mesh.add(pointLight);
            pointLight.position.y = 52;
            
            this.sin = Math.PI * 2 * (this.mesh.position.z/-250) * nbsin;
        });

        this.inputs = new InputManager();

        this.momentum = 0;

    }

    update(){
        if(this.mesh != null){
            if(this.inputs.getKey(37)){
                this.momentum = clamp(this.momentum - 50 * delta,-10,10);
            }else if(this.inputs.getKey(39)){
                this.momentum = clamp(this.momentum + 50 * delta,-10,10);
            }else{
                this.momentum -= this.momentum * 0.1;
            }

            this.mesh.rotation.y = Math.PI - Math.PI/180  * 10 * (this.momentum/10);
            this.mesh.rotation.z = Math.PI/180  * 15 * (this.momentum/10);

            this.mesh.position.x = clamp(this.mesh.position.x + this.momentum * delta,-2.3,2.3);

            this.mesh.position.y = 0.5 + Math.sin(this.sin + sinVal) * sinAmplitude;
        }
    }
}

class Building{
    constructor(x,y,scene){
        this.group = new THREE.Group(); 
        this.group.position.set(x,0,y);
        this.height = -20;
        this.rotspeed = Math.sign(Math.random() - 0.5) * (Math.random() * 5 + 5);
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
        this.group.rotation.y += this.rotspeed * delta * rotationSpeed;
        this.group.position.z += speed * delta;
    }

    addFloor(){
        let h = Math.random() * 7 + 5;
        let w = Math.random() * 10 + 10
        let g =  new THREE.BoxGeometry( w,h,w);
        let floor = new THREE.Mesh( g, this.material );
        floor.position.set(Math.random() * 4 - 2,this.height + h/2,Math.random() * 4 - 2);
        floor.rotation.y = Math.PI * 2 * Math.random();
        this.group.add(floor);

        this.height += h;
    }

    genFloors(){
        let nb = getRandomInt(10,25);
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

        this.rotationBeat = this.music.createBeat({factor:2});

        this.music.onceAt("start",3.5, function () {
            sinAmplitude = 1;
            speed = 20;
        }).after("drop1",24, function () {
            sinAmplitude = 3;
            speed = 50;
            setTimeout(function(){
                window.app.camera.fov = 130;
                window.app.camera.updateProjectionMatrix();
            },0.5);
        }).after("slow1",67, function () {
            
            sinAmplitude = 0;
            speed = 30;
        }).after("drop2",89, function () {       
            sinAmplitude = 5;
            speed = 60;
        }).after("slow2",130.5, function () {       
            sinAmplitude = 0;
            speed = 10;
        }).after("drop3",165, function () {       
            sinAmplitude = 5;
            speed = 100;
        }).after("end",251.5, function () {       
            sinAmplitude = 0;
            speed = 0;
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