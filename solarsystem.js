"use strict";

var canvas;
var gl;
var program;

var numTimesToSubdivide = 4;

var pointsArray = [];
var colorsArray = [];

var numStar = 250;

var near = 0.3;
var far = 10.0;
var fovy = 90.0;
var aspect;

var theta = 0.0;
var phi   = 0.0;

var mvMatrix, pMatrix;
var modelView, projection;

var eye = vec3(0.0, 0.0, 0.95);
var at  = vec3(0.0, 0.0, 0.0);
var up  = vec3(0.0, 1.0, 0.0);

var mouseDown  = false;
var lastMouseX = 0;
var lastMouseY = 0;

var va = vec4(0.0, 0.0, -1.0, 1);
var vb = vec4(0.0, 0.942809, 0.333333, 1);
var vc = vec4(-0.816497, -0.471405, 0.333333, 1);
var vd = vec4(0.816497, -0.471405, 0.333333, 1);

var vertices = [
    vec4(-3.0, -3.0,  3.0, 1.0),
    vec4(-3.0,  3.0,  3.0, 1.0),
    vec4( 3.0,  3.0,  3.0, 1.0),
    vec4( 3.0, -3.0,  3.0, 1.0),
    vec4(-3.0, -3.0, -3.0, 1.0),
    vec4(-3.0,  3.0, -3.0, 1.0),
    vec4( 3.0,  3.0, -3.0, 1.0),
    vec4( 3.0, -3.0, -3.0, 1.0)
];

var sunIndex = 0;
var sunPoints = [];

// for creating and orbiting tje planets around the sun
var planets = [];
var spherePoints = [];
var sphereCount = 0;
var orbitAngles = [];


function triangle(a, b, c) {
    sunPoints.push(a);
    sunPoints.push(b);
    sunPoints.push(c);
    sunIndex += 3;
}

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

function tetrahedron(a, b, c, d, n) {
    divideTriangle(a, b, c, n);
    divideTriangle(d, c, b, n);
    divideTriangle(a, d, b, n);
    divideTriangle(a, c, d, n);
}

function quad(a, b, c, d) {
    pointsArray.push(vertices[a]); colorsArray.push(vec4(0.0, 0.0, 0.0, 1.0));
    pointsArray.push(vertices[b]); colorsArray.push(vec4(0.0, 0.0, 0.0, 1.0));
    pointsArray.push(vertices[c]); colorsArray.push(vec4(0.0, 0.0, 0.0, 1.0));
    pointsArray.push(vertices[a]); colorsArray.push(vec4(0.0, 0.0, 0.0, 1.0));
    pointsArray.push(vertices[c]); colorsArray.push(vec4(0.0, 0.0, 0.0, 1.0));
    pointsArray.push(vertices[d]); colorsArray.push(vec4(0.0, 0.0, 0.0, 1.0));
}

function colorCube() {
    quad(1, 0, 3, 2);
    quad(2, 3, 7, 6);
    quad(3, 0, 4, 7);
    quad(6, 5, 1, 2);
    quad(4, 5, 6, 7);
    quad(5, 4, 0, 1);
}

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
        } else { tri(a, b, c); }
    }
    function tetra(a, b, c, d, n) {
        divide(a, b, c, n); divide(d, c, b, n);
        divide(a, d, b, n); divide(a, c, d, n);
    }

    tetra(va, vb, vc, vd, numTimesToSubdivide);
    spherePoints = tmpPoints;
    sphereCount  = tmpIndex;
}

/*
* Uodated so instead of x, y, z, it just has the distance from the center for orbit
* Distance: how far from sun, 
* Height: what y level it orbits on
* Size is radius of planet
* Speed: how fast the orbit is
* r,g,b: color values 
*/
function addPlanet(distance, height, size, speed, r, g, b) {
    var start = pointsArray.length;
    var color = vec4(r, g, b, 1.0);

    for (var i = 0; i < spherePoints.length; i++) {
        var p = spherePoints[i];
        pointsArray.push(vec4(
            p[0] * size,
            p[1] * size,
            p[2] * size,
            1.0
        ));
        colorsArray.push(color);
    }

    var planet = { distance:distance, height:height, size:size, speed:speed, color:color, start:start, count:sphereCount };
    planets.push(planet);
    orbitAngles.push(Math.random() * 2 * Math.PI);
    return planet;
}


window.onload = function init() {

    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = canvas.width / canvas.height;
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // make skybox
    colorCube();

    // make stars
    for (var i = 0; i < numStar; i++) {
        var r1 = Math.random() * 6 - 3;
        var r2 = Math.random() * 6 - 3;
        var c = Math.floor(Math.random() * 6) + 1;
        colorsArray.push(vec4(1.0, 1.0, 1.0, 1.0));
        if      (c === 1) pointsArray.push(vec4( 2.99, r1,   r2,   1));
        else if (c === 2) pointsArray.push(vec4(-2.99, r1,   r2,   1));
        else if (c === 3) pointsArray.push(vec4( r1,   2.99, r2,   1));
        else if (c === 4) pointsArray.push(vec4( r1,  -2.99, r2,   1));
        else if (c === 5) pointsArray.push(vec4( r1,   r2,   2.99, 1));
        else              pointsArray.push(vec4( r1,   r2,  -2.99, 1));
    }

    // make sun
    tetrahedron(va, vb, vc, vd, numTimesToSubdivide);

    // color sun
    for (var i = 0; i < sunIndex; i++) {
        colorsArray.push(vec4(1.0, 0.647, 0.0, 1.0));
    }

    // scale sphere
    var sunScale = 0.2;
    for (var i = 0; i < sunPoints.length; i++) {
        pointsArray.push(vec4(
            sunPoints[i][0] * sunScale,
            sunPoints[i][1] * sunScale,
            sunPoints[i][2] * sunScale,
            1.0
        ));
    }

    createSphere();

    //          dist   height  size   speed   r     g     b
    addPlanet(  1.2,   0.0,   0.18,  0.005,  0.2,  0.5,  1.0 );
    addPlanet(  0.8,   0.1,   0.10,  0.012,  0.8,  0.3,  0.1 );
    addPlanet(  1.6,  -0.1,   0.25,  0.003,  0.4,  0.8,  0.3 );
    addPlanet(  0.5,   0.2,   0.08,  0.020,  0.9,  0.8,  0.2 );

    var cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colorsArray), gl.STATIC_DRAW);

    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    var vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    modelView  = gl.getUniformLocation(program, "modelView");
    projection = gl.getUniformLocation(program, "projection");

    document.addEventListener("keydown", function(event) {
        var forward = vec3(
            Math.cos(theta) * Math.sin(phi),
            Math.sin(theta),
            -Math.cos(theta) * Math.cos(phi)
        );
        var right = normalize(cross(forward, up));

        if (event.key.toLowerCase() === "w") {
            eye[0] += forward[0] * 0.05;
            eye[1] += forward[1] * 0.05;
            eye[2] += forward[2] * 0.05;
        }
        if (event.key.toLowerCase() === "s") {
            eye[0] -= forward[0] * 0.05;
            eye[1] -= forward[1] * 0.05;
            eye[2] -= forward[2] * 0.05;
        }
        if (event.key.toLowerCase() === "a") {
            eye[0] -= right[0] * 0.05;
            eye[1] -= right[1] * 0.05;
            eye[2] -= right[2] * 0.05;
        }
        if (event.key.toLowerCase() === "d") {
            eye[0] += right[0] * 0.05;
            eye[1] += right[1] * 0.05;
            eye[2] += right[2] * 0.05;
        }
    });

    canvas.addEventListener("mousedown", function(event) {
        mouseDown  = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    });

    canvas.addEventListener("mouseup", function(event) {
        mouseDown = false;
    });

    canvas.addEventListener("mousemove", function(event) {
        if (!mouseDown) return;
        var dx = event.clientX - lastMouseX;
        var dy = event.clientY - lastMouseY;
        phi   += dx * 0.01;
        theta -= dy * 0.01;
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
    pMatrix  = perspective(fovy, aspect, near, far);

    gl.uniformMatrix4fv(modelView,  false, flatten(mvMatrix));
    gl.uniformMatrix4fv(projection, false, flatten(pMatrix));

    gl.drawArrays(gl.TRIANGLES, 0, 36);
    gl.drawArrays(gl.POINTS, 36, numStar);
    gl.drawArrays(gl.TRIANGLES, 36 + numStar, sunIndex);

    // spawns planets and matrix multiplaction for orbit
    for (var i = 0; i < planets.length; i++) {
        var p = planets[i];
        orbitAngles[i] += p.speed;
        var x = p.distance * Math.cos(orbitAngles[i]);
        var z = p.distance * Math.sin(orbitAngles[i]);

        var orbitMatrix = translate(x, p.height, z);
        var orbitMV = mult(mvMatrix, orbitMatrix);
        gl.uniformMatrix4fv(modelView, false, flatten(orbitMV));
        gl.drawArrays(gl.TRIANGLES, p.start, p.count);
    }

    gl.uniformMatrix4fv(modelView, false, flatten(mvMatrix));

    requestAnimFrame(render);
};
