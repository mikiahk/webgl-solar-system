"use strict";

// --- web gl globals ---
var canvas;
var gl;
var program;

// -- texture mapping globals ---
var texCoordArray = [];
var vTexCoordLoc;
var uUseTextureLoc;
var texBuffer;
var textures = {};

// --- scene settings ---
const SUBDIVISIONS = 4; // sphere smoothness
const SKYBOX_SIZE = 5.0
const NUM_STARS = 500; // number of random stars scattered on the skybox walls
const MOVE_SPEED = 0.05;
const MOUSE_DPI = 0.005;
var controls = true; // controls show if true

// perspective camera
var fovy = 90.0; // field of view in degrees
const NEAR = 0.3; // near clipping plane
const FAR = SKYBOX_SIZE * 3; // far clipping plane

// --- gemoetry buffer sent to gpu  ---
var vertices = []; 
var colorsArray = [];

// --- shader uniform handles ---
var mvMatrix, pMatrix; // matrix values
var modelView, projection; // uniform locations for the matrices
 
var aspect; // width/height ratio of the canvas

// --- camera look direction ---
var theta = -0.5; // vertical angle (radians)
var phi   = 0.0; // horizontal angle (radians)
// --- camera orientation and position ---
var eye = vec3(0.0, 2.0, 4.0);
var at  = vec3(0.0, 0.0, 0.0);
var up  = vec3(0.0, 1.0, 0.0);

// --- mouse state for drag to look ---
var mouseDown  = false;
var lastMouseX = 0;
var lastMouseY = 0;

// --- initial tetrahedron vertices for spheres ---
var va = vec4(0.0, 0.0, -1.0, 1);
var vb = vec4(0.0, 0.942809, 0.333333, 1);
var vc = vec4(-0.816497, -0.471405, 0.333333, 1);
var vd = vec4(0.816497, -0.471405, 0.333333, 1);


// --- sky box ---
var cube_vertices = [
    vec4(-SKYBOX_SIZE, -SKYBOX_SIZE,  SKYBOX_SIZE, 1.0),
    vec4(-SKYBOX_SIZE,  SKYBOX_SIZE,  SKYBOX_SIZE, 1.0),
    vec4( SKYBOX_SIZE,  SKYBOX_SIZE,  SKYBOX_SIZE, 1.0),
    vec4( SKYBOX_SIZE, -SKYBOX_SIZE,  SKYBOX_SIZE, 1.0),
    vec4(-SKYBOX_SIZE, -SKYBOX_SIZE, -SKYBOX_SIZE, 1.0),
    vec4(-SKYBOX_SIZE,  SKYBOX_SIZE, -SKYBOX_SIZE, 1.0),
    vec4( SKYBOX_SIZE,  SKYBOX_SIZE, -SKYBOX_SIZE, 1.0),
    vec4( SKYBOX_SIZE, -SKYBOX_SIZE, -SKYBOX_SIZE, 1.0)
];

// --- sun geometry ---
var sunIndex = 0;
var sunPoints = [];

// --- planets ---
var planets = [];
var spherePoints = [];
var sphereCount = 0;

// -----------------------------------------------------------------------
// --- sun geometery helpers ---
// -----------------------------------------------------------------------

function triangle(a, b, c) {
    sunPoints.push(a);
    sunPoints.push(b);
    sunPoints.push(c);
    sunIndex += 3;
}

// recursively subdivides triangle abc by splitting each edge at its midpoint
// and projecting that midpoint onto the unit sphere
function divideTriangle(a, b, c, count) {
    if (count > 0) {
        var ab = normalize(mix(a, b, 0.5), true);
        var ac = normalize(mix(a, c, 0.5), true);
        var bc = normalize(mix(b, c, 0.5), true);
        divideTriangle(a, ab, ac, count - 1);
        divideTriangle(ab, b, bc, count - 1);
        divideTriangle(bc, c, ac, count - 1);
        divideTriangle(ab, bc, ac, count - 1);
    } else {
        triangle(a, b, c);
    }
}

// subdivides all four faces of a tetrahedron to approximate a sphere 
function tetrahedron(a, b, c, d, n) {
    divideTriangle(a, b, c, n);
    divideTriangle(d, c, b, n);
    divideTriangle(a, d, b, n);
    divideTriangle(a, c, d, n);
}

// -----------------------------------------------------------------------
// --- skybox helpers ---
// -----------------------------------------------------------------------
function quad(a, b, c, d) {
    vertices.push(cube_vertices[a]); colorsArray.push(vec4(0.0, 0.0, 0.0, 1.0));
    vertices.push(cube_vertices[b]); colorsArray.push(vec4(0.0, 0.0, 0.0, 1.0));
    vertices.push(cube_vertices[c]); colorsArray.push(vec4(0.0, 0.0, 0.0, 1.0));
    
    vertices.push(cube_vertices[a]); colorsArray.push(vec4(0.0, 0.0, 0.0, 1.0));
    vertices.push(cube_vertices[c]); colorsArray.push(vec4(0.0, 0.0, 0.0, 1.0));
    vertices.push(cube_vertices[d]); colorsArray.push(vec4(0.0, 0.0, 0.0, 1.0));
}

// builds all six faces of the skybox cube using vertex index pairs
function colorCube() {
    quad(1, 0, 3, 2); // front face
    quad(2, 3, 7, 6); // right face
    quad(3, 0, 4, 7); // bottom face
    quad(6, 5, 1, 2); // top face
    quad(4, 5, 6, 7); // back face
    quad(5, 4, 0, 1); // left face
}


// -----------------------------------------------------------------------
// --- planet sphere helper ---
// -----------------------------------------------------------------------
function createSphere() {
    var tmpPoints = [];
    var tmpIndex  = 0;

    function tri(a, b, c) {
        tmpPoints.push(a); tmpPoints.push(b); tmpPoints.push(c);
        tmpIndex += 3;
    }
   
    function divide(a, b, c, n) {
        if (n > 0) {
            var ab = normalize(mix(a, b, 0.5), true);
            var ac = normalize(mix(a, c, 0.5), true);
            var bc = normalize(mix(b, c, 0.5), true);
            divide(a, ab, ac, n - 1);
            divide(ab, b, bc, n - 1);
            divide(bc, c, ac, n - 1);
            divide(ab, bc, ac, n - 1);
        } else { 
            tri(a, b, c);
        }
    }
    function tetra(a, b, c, d, n) {
        divide(a, b, c, n); divide(d, c, b, n);
        divide(a, d, b, n); divide(a, c, d, n);
    }

    tetra(va, vb, vc, vd, SUBDIVISIONS);
    spherePoints = tmpPoints;
    sphereCount  = tmpIndex;
}

// -----------------------------------------------------------------------
// --- build planets ---
// -----------------------------------------------------------------------
function buildPlanet(distance, height, size, speed, r, g, b, textureName) {
    var start = vertices.length;
    var color = vec4(r, g, b, 1.0);

    for (var i = 0; i < spherePoints.length; i++) {
        var p = spherePoints[i];
        vertices.push(vec4(
            p[0] * size,
            p[1] * size,
            p[2] * size,
            1.0
        ));
        colorsArray.push(color);

        if(textureName){
            var u = 0.5 + Math.atan2(p[2], p[0]) / (2.0 * Math.PI);
            var v = 0.5 - Math.asin(Math.max(-1, Math.min(1, p[1]))) / Math.PI;
            texCoordArray.push(vec2(u,v)); // parametric calculation
        }else{
            texCoordArray.push(vec2(0.0, 0.0)); // placeholder to keep alignment
        }
    }

    var planet = { 
        distance:distance, 
        height:height, 
        size:size, 
        speed:speed, 
        color:color, 
        start:start, 
        count:sphereCount,
        textureName: textureName || null,
        orbitAngle: (Math.random() * 2 * Math.PI), // random starting orbit
        // orbitAngle: 0.0 // same starting orbit
		selfRotationAngle: 0.0
    };

    planets.push(planet);
    return planet;
}

function loadTexture(name, imageId){
    var tex = gl.createTexture();
    var image = document.getElementById(imageId);
    
    function upload(){
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        textures[name] = tex;
    }
    
    image.onload = upload;
    if(image.complete) upload();

}


window.onload = function init() {

    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = canvas.width / canvas.height;
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // make skybox
    colorCube();

    // make stars
    var offset = 0.01
    for (var i = 0; i < NUM_STARS; i++) {
        var r1 = Math.random() * SKYBOX_SIZE * 2 - SKYBOX_SIZE;
        var r2 = Math.random() * SKYBOX_SIZE * 2 - SKYBOX_SIZE;
        var c = Math.floor(Math.random() * 6) + 1;
        colorsArray.push(vec4(1.0, 1.0, 1.0, 1.0));
        if (c === 1) {
			vertices.push(vec4( SKYBOX_SIZE - offset, r1,   r2,   1));
		} else if (c === 2) {
			vertices.push(vec4(-SKYBOX_SIZE + offset, r1,   r2,   1));
		} else if (c === 3) {
			vertices.push(vec4( r1,   SKYBOX_SIZE - offset, r2,   1));
		} else if (c === 4) {
			vertices.push(vec4( r1,  -SKYBOX_SIZE + offset, r2,   1));
		} else if (c === 5) {
			vertices.push(vec4( r1,   r2,   SKYBOX_SIZE - offset, 1));
		} else {
			vertices.push(vec4( r1,   r2,  -SKYBOX_SIZE + offset, 1));
		}
    }

    // make sun
    tetrahedron(va, vb, vc, vd, SUBDIVISIONS);

    // color sun
    for (var i = 0; i < sunIndex; i++) {
        colorsArray.push(vec4(1.0, 0.647, 0.0, 1.0));
    }

    // scale sphere
    var sunScale = 0.2;
    for (var i = 0; i < sunPoints.length; i++) {
        vertices.push(vec4(
            sunPoints[i][0] * sunScale,
            sunPoints[i][1] * sunScale,
            sunPoints[i][2] * sunScale,
            1.0
        ));
    }

    var nonPlanetCount = 36 + NUM_STARS + sunIndex;
    for (var i = 0; i < nonPlanetCount; i++){
        texCoordArray.push(vec2(0.0, 0.0)); // placeholder to keep alignment
    }

    createSphere();

    //          dist   height size   speed    r     g     b
    buildPlanet(0.50,  0.0,   0.08,  0.0100,  0.9,  0.8,  0.2, null); //yellow
    buildPlanet(1.25,  0.0,   0.10,  0.0012,  0.8,  0.3,  0.1, null); //orange
    buildPlanet(1.75,  0.0,   0.18,  0.0007,  0.0,  0.0,  0.0, "earth"); //earth
    buildPlanet(2.75,  0.0,   0.25,  0.0005,  0.0,  0.0,  0.0, "mars"); //mars
    buildPlanet(4.00,  0.0,   0.50,  0.0003,  0.0,  0.0,  0.0, "jupiter"); //jupiter

    var cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colorsArray), gl.STATIC_DRAW);

    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    var vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);
//------------------
    texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(texCoordArray), gl.STATIC_DRAW);

    vTexCoordLoc = gl.getAttribLocation(program, "vTexCoord");
    gl.vertexAttribPointer(vTexCoordLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vTexCoordLoc);

    uUseTextureLoc = gl.getUniformLocation(program, "uUseTexture");
    var uTextureLoc = gl.getUniformLocation(program, "uTexture");


    loadTexture("earth", "earth");
    loadTexture("mars", "mars");
    loadTexture("jupiter", "jupiter");
//------------------
    modelView  = gl.getUniformLocation(program, "modelView");
    projection = gl.getUniformLocation(program, "projection");


// -----------------------------------------------------------------------
// --- key handlers ---
// -----------------------------------------------------------------------

    document.addEventListener("keydown", function(event) {
        var forward = vec3(
            Math.cos(theta) * Math.sin(phi),
            Math.sin(theta),
            -Math.cos(theta) * Math.cos(phi)
        );
        var right = normalize(cross(forward, up));

        if (event.key.toLowerCase() === "w") {
            eye[0] += forward[0] * MOVE_SPEED;
            eye[1] += forward[1] * MOVE_SPEED;
            eye[2] += forward[2] * MOVE_SPEED;
        }
        if (event.key.toLowerCase() === "s") {
            eye[0] -= forward[0] * MOVE_SPEED;
            eye[1] -= forward[1] * MOVE_SPEED;
            eye[2] -= forward[2] * MOVE_SPEED;
        }
        if (event.key.toLowerCase() === "a") {
            eye[0] -= right[0] * MOVE_SPEED;
            eye[1] -= right[1] * MOVE_SPEED;
            eye[2] -= right[2] * MOVE_SPEED;
        }
        if (event.key.toLowerCase() === "d") {
            eye[0] += right[0] * MOVE_SPEED;
            eye[1] += right[1] * MOVE_SPEED;
            eye[2] += right[2] * MOVE_SPEED;
        }
        if (event.key.toLowerCase() == 'e'){
            eye[1] += MOVE_SPEED
        }
        if (event.key.toLowerCase() == 'q'){
            eye[1] -= MOVE_SPEED
        }
		// key handler event for showing controls
		if (event.key.toLowerCase() === "h") {
			controls = !controls;
			document.getElementById("controls").style.display = controls ? "block" : "none";
		}
    
    });

    document.addEventListener("wheel", function(event) {
        fovy += event.deltaY * 0.05;
        fovy = Math.max(10.0, Math.min(120.0, fovy));
    })

    canvas.addEventListener("mousedown", function(event) {
        mouseDown  = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    });

    canvas.addEventListener("mouseup", function(event) {
        mouseDown = false;
    });

    canvas.addEventListener("mousemove", function(event) {
        if (!mouseDown) {
            document.body.style.cursor="default";
            return;
        }
        document.body.style.cursor="none";
        var dx = event.clientX - lastMouseX;
        var dy = event.clientY - lastMouseY;
        phi   += dx * MOUSE_DPI;
        theta -= dy * MOUSE_DPI;
        theta  = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, theta));
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    });

    render();
};


var render = function() {

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var atX = Math.cos(theta) * Math.sin(phi);
    var atY = Math.sin(theta);
    var atZ = -Math.cos(theta) * Math.cos(phi);

    mvMatrix = lookAt(eye, vec3(eye[0] + atX, eye[1] + atY, eye[2] + atZ), up);
    pMatrix  = perspective(fovy, aspect, NEAR, FAR);

    gl.uniformMatrix4fv(modelView,  false, flatten(mvMatrix));
    gl.uniformMatrix4fv(projection, false, flatten(pMatrix));

    gl.drawArrays(gl.TRIANGLES, 0, 36); // skybox
    gl.drawArrays(gl.POINTS, 36, NUM_STARS); // stars
    gl.drawArrays(gl.TRIANGLES, 36 + NUM_STARS, sunIndex); // sun

    // planets and matrix multiplaction for orbit
    for (var i = 0; i < planets.length; i++) {
        var planet = planets[i];
        planet.orbitAngle += planet.speed;
		planet.selfRotationAngle += 0.0005 / planet.size;
        var x = planet.distance * Math.cos(planet.orbitAngle);
        var z = planet.distance * Math.sin(planet.orbitAngle);

        var orbitMV = mult(mvMatrix, translate(x, planet.height, z));
		orbitMV = mult(orbitMV, rotate(planet.selfRotationAngle * (180 / Math.PI), vec3(0, 1, 0)));
        gl.uniformMatrix4fv(modelView, false, flatten(orbitMV));

        if(planet.textureName && textures[planet.textureName]){
            gl.uniform1f(uUseTextureLoc, 1.0); // set to texture and send texture
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textures[planet.textureName]);
        }else{
            gl.uniform1f(uUseTextureLoc, 0.0); // set back to no texture for other planets
        }

        gl.drawArrays(gl.TRIANGLES, planet.start, planet.count);
    }

    gl.uniform1f(uUseTextureLoc, 0.0); // set back to no texture for skybox, stars, etc.
    gl.uniformMatrix4fv(modelView, false, flatten(mvMatrix));

    requestAnimFrame(render);
};
