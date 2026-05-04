"use strict";

var canvas;
var gl;

var numVertices = 36;
var starRadius = 0.05;
var numStar = 250;
const rad = Math.PI / 180;

var pointsArray = [];
var colorsArray = [];

var numTimesToSubdivide = 4;
var sphereIndex = 0;
var spherePoints = [];
var sphereNormals = [];

var va = vec4(0.0, 0.0, -1.0, 1);
var vb = vec4(0.0, 0.942809, 0.333333, 1);
var vc = vec4(-0.816497, -0.471405, 0.333333, 1);
var vd = vec4(0.816497, -0.471405, 0.333333, 1);

var vertices = [
    vec4(-2.0, -2.0,  2.0, 1.0),
    vec4(-2.0,  2.0,  2.0, 1.0),
    vec4( 2.0,  2.0,  2.0, 1.0),
    vec4( 2.0, -2.0,  2.0, 1.0),
    vec4(-2.0, -2.0, -2.0, 1.0),
    vec4(-2.0,  2.0, -2.0, 1.0),
    vec4( 2.0,  2.0, -2.0, 1.0),
    vec4( 2.0, -2.0, -2.0, 1.0)
];

var vertexColors = [
    vec4(0.0, 0.0, 0.0, 1.0),
    vec4(1.0, 0.0, 0.0, 1.0),
    vec4(1.0, 1.0, 0.0, 1.0),
    vec4(0.0, 1.0, 0.0, 1.0),
    vec4(0.0, 0.0, 1.0, 1.0),
    vec4(1.0, 0.0, 1.0, 1.0),
    vec4(0.0, 1.0, 1.0, 1.0),
    vec4(1.0, 1.0, 1.0, 1.0)
];

var near = 0.3;
var far = 10.0;
var fovy = 90.0;
var aspect;

var theta = 0.0;
var phi = 0.0;

var mvMatrix, pMatrix;
var modelView, projection;

var eye = vec3(0.0, 0.0, 0.95);
const up = vec3(0.0, 1.0, 0.0);

var mouseDown = false;
var lastMouseX = 0;
var lastMouseY = 0;

function quad(a, b, c, d) {
    pointsArray.push(vertices[a]);
    colorsArray.push(vertexColors[0]);
    pointsArray.push(vertices[b]);
    colorsArray.push(vertexColors[0]);
    pointsArray.push(vertices[c]);
    colorsArray.push(vertexColors[0]);
    pointsArray.push(vertices[a]);
    colorsArray.push(vertexColors[0]);
    pointsArray.push(vertices[c]);
    colorsArray.push(vertexColors[0]);
    pointsArray.push(vertices[d]);
    colorsArray.push(vertexColors[0]);
}

function colorCube()
{
    quad( 1, 0, 3, 2 );
    quad( 2, 3, 7, 6 );
    quad( 3, 0, 4, 7 );
    quad( 6, 5, 1, 2 );
    quad( 4, 5, 6, 7 );
    quad( 5, 4, 0, 1 );
}

function triangle(a, b, c) {
    spherePoints.push(a);
    spherePoints.push(b);
    spherePoints.push(c);
    sphereIndex += 3;
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

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = canvas.width / canvas.height;

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    colorCube();

    for (var i = 0; i < numStar; i++) {
        var r1 = Math.random() * 2 - 1;
        var r2 = Math.random() * 2 - 1;
        var c = Math.floor(Math.random() * 6) + 1;
        colorsArray.push(vec4(1.0, 1.0, 1.0, 1.0));
        if (c === 1) pointsArray.push(vec4(0.99, r1, r2, 1));
        else if (c === 2) pointsArray.push(vec4(-0.99, r1, r2, 1));
        else if (c === 3) pointsArray.push(vec4(r1, 0.99, r2, 1));
        else if (c === 4) pointsArray.push(vec4(r1, -0.99, r2, 1));
        else if (c === 5) pointsArray.push(vec4(r1, r2, 0.99, 1));
        else pointsArray.push(vec4(r1, r2, -0.99, 1));
    }
	
	tetrahedron(va, vb, vc, vd, numTimesToSubdivide);
	

	for (var i = 0; i < sphereIndex; i++) {
		colorsArray.push(vec4(1.0, 0.647, 0.0));
	}

	var sphereScale = 0.2;
	for (var i = 0; i < spherePoints.length; i++) {
		pointsArray.push(vec4(
			spherePoints[i][0] * sphereScale,
			spherePoints[i][1] * sphereScale,
			spherePoints[i][2] * sphereScale,
			1.0
		));
	}

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

    modelView = gl.getUniformLocation(program, "modelView");
    projection = gl.getUniformLocation(program, "projection");

    var fovSlider = document.getElementById("FOVslider");
    var pitchSlider = document.getElementById("Pitchslider");
    var yawSlider = document.getElementById("Yawslider");
    fovSlider.oninput = function(){fovy = parseFloat(fovSlider.value);}
    pitchSlider.oninput = function(){theta = parseFloat(pitchSlider.value);}
    yawSlider.oninput = function(){phi = parseFloat(yawSlider.value);}

    document.addEventListener("keydown", function(event) {
        var forward = vec3(
            Math.cos(theta) * Math.sin(phi),
            Math.sin(theta),
            -Math.cos(theta) * Math.cos(phi)
        );

        var right = normalize(cross(forward, up));

        if (event.key.toLowerCase() === "w") {
            eye[0] += forward[0] * 0.005;
            eye[1] += forward[1] * 0.005;
            eye[2] += forward[2] * 0.005;
        }
        if (event.key.toLowerCase() === "s") {
            eye[0] -= forward[0] * 0.005;
            eye[1] -= forward[1] * 0.005;
            eye[2] -= forward[2] * 0.005;
        }
        if (event.key.toLowerCase() === "a") {
            eye[0] -= right[0] * 0.005;
            eye[1] -= right[1] * 0.005;
            eye[2] -= right[2] * 0.005;
        }
        if (event.key.toLowerCase() === "d") {
            eye[0] += right[0] * 0.005;
            eye[1] += right[1] * 0.005;
            eye[2] += right[2] * 0.005;
        }
    });
	
	canvas.addEventListener("mousedown", function(event) {
		mouseDown = true;
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

    
			theta = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, theta));

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
    pMatrix = perspective(fovy, aspect, near, far);

    gl.uniformMatrix4fv(modelView, false, flatten(mvMatrix));
    gl.uniformMatrix4fv(projection, false, flatten(pMatrix));

    gl.drawArrays(gl.TRIANGLES, 0, 36);
    gl.drawArrays(gl.POINTS, 36, numStar);
	gl.drawArrays(gl.TRIANGLES, 36 + numStar, sphereIndex);

    requestAnimFrame(render);
};
