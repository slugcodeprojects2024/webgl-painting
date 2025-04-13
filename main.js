// Global variables
let canvas;
let gl;
let a_Position;
let a_Color;
let u_PointSize;
let shapesList = []; // List of all shapes to draw
let currentShapeType = 'point'; // Current shape type: 'point', 'triangle', or 'circle'
let isMouseDown = false;
let lastMousePos = { x: 0, y: 0 };
let rainbowMode = false;
let rainbowOffset = 0;

// Add references to functions from advanced_features.js
let animationManager; // Will be set by advanced_features.js
let shapeCatcherGame; // Will be set by advanced_features.js
let addAnimatedStroke; // Will be set by advanced_features.js

// Class for generic Shape
class Shape {
    constructor(type, vertices, color, size = 10, segments = 12, alpha = 1.0) {
        this.type = type;
        this.vertices = vertices;
        this.color = color;
        this.size = size;
        this.segments = segments;
        this.alpha = alpha;
    }

    render() {
        // This will be overridden by subclasses
    }
}

// Point shape
class Point extends Shape {
    constructor(x, y, color, size, alpha = 1.0) {
        super('point', [[x, y]], color, size, 0, alpha);
    }

    render() {
        const rgba = [...this.color, this.alpha];
        
        gl.vertexAttrib3f(a_Position, this.vertices[0][0], this.vertices[0][1], 0.0);
        gl.vertexAttrib4f(a_Color, rgba[0], rgba[1], rgba[2], rgba[3]);
        gl.uniform1f(u_PointSize, this.size);
        gl.drawArrays(gl.POINTS, 0, 1);
    }
}

// Triangle shape
class Triangle extends Shape {
    constructor(vertices, color, size, alpha = 1.0) {
        super('triangle', vertices, color, size, 0, alpha);
    }

    render() {
        const rgba = [...this.color, this.alpha];
        
        // Create buffer object
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        
        // Set vertex data
        const verticesFlat = this.vertices.flat();
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verticesFlat), gl.STATIC_DRAW);
        
        // Assign buffer to a_Position and enable it
        gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);
        
        // Set color for all vertices
        gl.vertexAttrib4f(a_Color, rgba[0], rgba[1], rgba[2], rgba[3]);
        
        // Draw the triangle
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        
        // Clean up
        gl.disableVertexAttribArray(a_Position);
        gl.deleteBuffer(vertexBuffer);
    }
}

// Circle shape
class Circle extends Shape {
    constructor(x, y, color, size, segments = 12, alpha = 1.0) {
        super('circle', [[x, y]], color, size, segments, alpha);
    }

    render() {
        const rgba = [...this.color, this.alpha];
        const centerX = this.vertices[0][0];
        const centerY = this.vertices[0][1];
        const radius = this.size / 100; // Scale size to a reasonable radius
        const segments = this.segments;
        
        // Create vertices for triangle fan
        const circleVertices = [[centerX, centerY]]; // Center point
        
        for (let i = 0; i <= segments; i++) {
            const angle = i * 2 * Math.PI / segments;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            circleVertices.push([x, y]);
        }
        
        // Create buffer object
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        
        // Set vertex data
        const verticesFlat = circleVertices.flat();
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verticesFlat), gl.STATIC_DRAW);
        
        // Assign buffer to a_Position and enable it
        gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);
        
        // Set color for all vertices
        gl.vertexAttrib4f(a_Color, rgba[0], rgba[1], rgba[2], rgba[3]);
        
        // Draw the triangle fan
        gl.drawArrays(gl.TRIANGLE_FAN, 0, circleVertices.length);
        
        // Clean up
        gl.disableVertexAttribArray(a_Position);
        gl.deleteBuffer(vertexBuffer);
    }
}

// Line segment for continuous drawing
class Line extends Shape {
    constructor(startX, startY, endX, endY, color, size, alpha = 1.0) {
        super('line', [[startX, startY], [endX, endY]], color, size, 0, alpha);
    }
    
    render() {
        const rgba = [...this.color, this.alpha];
        
        // Create buffer object
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        
        // Set vertex data
        const verticesFlat = this.vertices.flat();
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verticesFlat), gl.STATIC_DRAW);
        
        // Assign buffer to a_Position and enable it
        gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);
        
        // Set color and line width
        gl.vertexAttrib4f(a_Color, rgba[0], rgba[1], rgba[2], rgba[3]);
        gl.lineWidth(this.size);
        
        // Draw the line
        gl.drawArrays(gl.LINES, 0, 2);
        
        // Clean up
        gl.disableVertexAttribArray(a_Position);
        gl.deleteBuffer(vertexBuffer);
    }
}

// Initialize WebGL
function setupWebGL() {
    // Get canvas element
    canvas = document.getElementById('canvas');
    
    // Get WebGL context
    gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) {
        console.error('Failed to get WebGL context');
        return;
    }
    
    // Set clear color
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    
    // Enable alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Clear canvas
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    return gl;
}

// Compile shaders and connect variables
function connectVariablesToGLSL() {
    // Get shader elements
    const vsSource = document.getElementById('vertex-shader').textContent;
    const fsSource = document.getElementById('fragment-shader').textContent;
    
    // Initialize shaders
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    
    // Create program and attach shaders
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    // Check if linking succeeded
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Failed to link program: ' + gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return;
    }
    
    // Use program
    gl.useProgram(program);
    
    // Get attribute and uniform locations
    a_Position = gl.getAttribLocation(program, 'a_Position');
    a_Color = gl.getAttribLocation(program, 'a_Color');
    u_PointSize = gl.getUniformLocation(program, 'u_PointSize');
    
    return program;
}

// Compile shader helper function
function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    // Check if compilation succeeded
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation failed: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    
    return shader;
}

// Convert canvas coordinates to WebGL coordinates
function canvasToGLCoord(x, y) {
    const rect = canvas.getBoundingClientRect();
    const canvasX = x - rect.left;
    const canvasY = y - rect.top;
    
    // Convert to WebGL coordinates (-1 to 1)
    const glX = (canvasX / canvas.width) * 2 - 1;
    const glY = -(canvasY / canvas.height) * 2 + 1;
    
    return { x: glX, y: glY };
}

// Handle click/draw events
function handleMouseEvent(event, isMove = false) {
    // Don't draw if game is active
    if (shapeCatcherGame.active) return;
    
    // Get current settings
    const red = parseFloat(document.getElementById('redSlider').value);
    const green = parseFloat(document.getElementById('greenSlider').value);
    const blue = parseFloat(document.getElementById('blueSlider').value);
    const alpha = parseFloat(document.getElementById('alphaSlider').value);
    const size = parseInt(document.getElementById('sizeSlider').value);
    const segments = parseInt(document.getElementById('segmentsSlider').value);
    
    // Get color (with potential rainbow mode)
    let color = [red, green, blue];
    if (rainbowMode) {
        color = getRainbowColor();
        rainbowOffset += 0.02;
    }
    
    // Get coordinates
    const coords = canvasToGLCoord(event.clientX, event.clientY);
    
    // If it's a move and mouse is down, we need to handle continuous drawing
    if (isMove && isMouseDown) {
        const currentPos = coords;
        
        // Calculate direction for oriented shapes
        const dx = currentPos.x - lastMousePos.x;
        const dy = currentPos.y - lastMousePos.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        // Only add a shape if we've moved a minimum distance (prevents too many shapes)
        if (distance > 0.005) {
            // For continuous line drawing
            if (currentShapeType === 'point') {
                // Create line for continuous point drawing
                shapesList.push(new Line(
                    lastMousePos.x, lastMousePos.y,
                    currentPos.x, currentPos.y,
                    color, size / 10, alpha
                ));
                
                // Add animated stroke for visual effect
                addAnimatedStroke(
                    lastMousePos.x, lastMousePos.y,
                    currentPos.x, currentPos.y,
                    color, size / 5
                );
            }
            
            // Add the main shape based on current type
            addShape(currentPos.x, currentPos.y, color, size, segments, alpha, dx, dy);
            
            // Add particles for visual feedback
            if (Math.random() < 0.3) { // Only add particles occasionally
                animationManager.addParticleSystem(currentPos.x, currentPos.y, color, 10);
            }
            
            // Update last position
            lastMousePos = { ...currentPos };
            
            // Render all shapes
            renderAllShapes();
        }
    } else {
        // For single clicks, just add the shape
        addShape(coords.x, coords.y, color, size, segments, alpha);
        
        // Add particles for visual feedback
        animationManager.addParticleSystem(coords.x, coords.y, color, 15);
        
        lastMousePos = { ...coords };
        
        // Render all shapes
        renderAllShapes();
    }
}

// Add shape based on current shape type
function addShape(x, y, color, size, segments, alpha, dx = 0, dy = 0) {
    switch (currentShapeType) {
        case 'point':
            shapesList.push(new Point(x, y, color, size, alpha));
            break;
        case 'triangle':
            // If we have direction info (from mouse drag), orient the triangle
            if (dx !== 0 || dy !== 0) {
                // Calculate perpendicular direction
                const perpX = -dy;
                const perpY = dx;
                const length = size / 100;
                
                // Create oriented triangle vertices
                const vertices = [
                    [x, y], // Tip of the triangle
                    [x - dx*length*2 + perpX*length, y - dy*length*2 + perpY*length],
                    [x - dx*length*2 - perpX*length, y - dy*length*2 - perpY*length]
                ];
                
                shapesList.push(new Triangle(vertices, color, size, alpha));
            } else {
                // For a simple click, create an equilateral triangle
                const sideLength = size / 100;
                const height = sideLength * Math.sqrt(3) / 2;
                
                const vertices = [
                    [x, y + height/2],
                    [x - sideLength/2, y - height/2],
                    [x + sideLength/2, y - height/2]
                ];
                
                shapesList.push(new Triangle(vertices, color, size, alpha));
            }
            break;
        case 'circle':
            shapesList.push(new Circle(x, y, color, size, segments, alpha));
            break;
    }
}

// Render all shapes
function renderAllShapes() {
    // Clear canvas
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Render each shape
    for (const shape of shapesList) {
        shape.render();
    }
}

// Get rainbow color based on position and time
function getRainbowColor() {
    return [
        Math.sin(rainbowOffset) * 0.5 + 0.5,
        Math.sin(rainbowOffset + 2) * 0.5 + 0.5,
        Math.sin(rainbowOffset + 4) * 0.5 + 0.5
    ];
}

// Draw a predefined picture using triangles
function drawPicture() {
    // A simple tree picture
    const treeColor = [0.2, 0.8, 0.2]; // Green
    const trunkColor = [0.6, 0.4, 0.2]; // Brown
    
    // Tree trunk
    shapesList.push(new Triangle(
        [[-0.1, -0.3], [-0.1, 0.0], [0.1, 0.0]],
        trunkColor, 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[-0.1, -0.3], [0.1, -0.3], [0.1, 0.0]],
        trunkColor, 10, 1.0
    ));
    
    // Tree foliage (multiple triangles)
    // Bottom layer
    shapesList.push(new Triangle(
        [[0.0, 0.5], [-0.3, 0.0], [0.3, 0.0]],
        treeColor, 10, 0.9
    ));
    
    // Middle layer
    shapesList.push(new Triangle(
        [[0.0, 0.7], [-0.25, 0.2], [0.25, 0.2]],
        treeColor, 10, 0.9
    ));
    
    // Top layer
    shapesList.push(new Triangle(
        [[0.0, 0.9], [-0.2, 0.4], [0.2, 0.4]],
        treeColor, 10, 0.9
    ));
    
    // Ground/grass
    shapesList.push(new Triangle(
        [[-1.0, -1.0], [1.0, -1.0], [-1.0, -0.3]],
        [0.4, 0.8, 0.3], 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[1.0, -1.0], [1.0, -0.3], [-1.0, -0.3]],
        [0.4, 0.8, 0.3], 10, 1.0
    ));
    
    // Sun
    const sunColor = [1.0, 0.9, 0.0];
    shapesList.push(new Triangle(
        [[0.7, 0.7], [0.5, 0.5], [0.9, 0.5]],
        sunColor, 10, 0.9
    ));
    shapesList.push(new Triangle(
        [[0.7, 0.7], [0.5, 0.9], [0.9, 0.9]],
        sunColor, 10, 0.9
    ));
    shapesList.push(new Triangle(
        [[0.5, 0.9], [0.7, 0.7], [0.5, 0.5]],
        sunColor, 10, 0.9
    ));
    shapesList.push(new Triangle(
        [[0.9, 0.9], [0.7, 0.7], [0.9, 0.5]],
        sunColor, 10, 0.9
    ));
    
    // Sky background (light blue)
    shapesList.push(new Triangle(
        [[-1.0, 1.0], [1.0, 1.0], [-1.0, -0.3]],
        [0.6, 0.8, 1.0], 10, 0.5
    ));
    shapesList.push(new Triangle(
        [[1.0, 1.0], [1.0, -0.3], [-1.0, -0.3]],
        [0.6, 0.8, 1.0], 10, 0.5
    ));
    
    // Cloud 1 (multiple triangles)
    const cloudColor = [1.0, 1.0, 1.0];
    shapesList.push(new Triangle(
        [[-0.7, 0.7], [-0.5, 0.8], [-0.9, 0.8]],
        cloudColor, 10, 0.8
    ));
    shapesList.push(new Triangle(
        [[-0.7, 0.9], [-0.5, 0.8], [-0.9, 0.8]],
        cloudColor, 10, 0.8
    ));
    
    // Cloud 2
    shapesList.push(new Triangle(
        [[-0.3, 0.6], [-0.1, 0.7], [-0.5, 0.7]],
        cloudColor, 10, 0.8
    ));
    shapesList.push(new Triangle(
        [[-0.3, 0.8], [-0.1, 0.7], [-0.5, 0.7]],
        cloudColor, 10, 0.8
    ));
    
    // Bird 1
    const birdColor = [0.3, 0.3, 0.3];
    shapesList.push(new Triangle(
        [[-0.8, 0.4], [-0.7, 0.5], [-0.9, 0.5]],
        birdColor, 10, 0.7
    ));
    shapesList.push(new Triangle(
        [[-0.6, 0.4], [-0.7, 0.5], [-0.8, 0.4]],
        birdColor, 10, 0.7
    ));
    
    // Bird 2
    shapesList.push(new Triangle(
        [[-0.5, 0.3], [-0.4, 0.4], [-0.6, 0.4]],
        birdColor, 10, 0.7
    ));
    shapesList.push(new Triangle(
        [[-0.3, 0.3], [-0.4, 0.4], [-0.5, 0.3]],
        birdColor, 10, 0.7
    ));
    
    // Render all shapes
    renderAllShapes();
}

// Function to save canvas as an image
function saveCanvasAsImage() {
    const link = document.createElement('a');
    link.download = 'webgl-painting.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// Initialize everything when page loads
window.onload = function() {
    // Setup WebGL
    gl = setupWebGL();
    if (!gl) return;
    
    // Connect variables to GLSL
    connectVariablesToGLSL();
    
    // Setup event listeners
    canvas.addEventListener('mousedown', function(event) {
        isMouseDown = true;
        handleMouseEvent(event);
    });
    
    canvas.addEventListener('mousemove', function(event) {
        handleMouseEvent(event, true);
    });
    
    canvas.addEventListener('mouseup', function() {
        isMouseDown = false;
    });
    
    canvas.addEventListener('mouseleave', function() {
        isMouseDown = false;
    });
    
    // Set up UI controls
    document.getElementById('pointsBtn').addEventListener('click', function() {
        currentShapeType = 'point';
        updateButtonSelection('pointsBtn');
    });
    
    document.getElementById('trianglesBtn').addEventListener('click', function() {
        currentShapeType = 'triangle';
        updateButtonSelection('trianglesBtn');
    });
    
    document.getElementById('circlesBtn').addEventListener('click', function() {
        currentShapeType = 'circle';
        updateButtonSelection('circlesBtn');
    });
    
    document.getElementById('clearCanvas').addEventListener('click', function() {
        shapesList = [];
        renderAllShapes();
    });
    
    document.getElementById('drawPicture').addEventListener('click', function() {
        drawPicture();
        
        // Show the reference image section
        document.getElementById('inspirationImage').style.display = 'block';
        
        // Create and display design sketch
        const img = document.getElementById('drawingReference');
        img.src = 'sketch_placeholder.png'; // Replace with an actual image path
    });
    
    // Add event listeners for Download, Rainbow Mode and Mini-Game buttons
    document.getElementById('downloadBtn').addEventListener('click', function() {
        saveCanvasAsImage();
    });
    
    document.getElementById('rainbowModeBtn').addEventListener('click', function() {
        rainbowMode = !rainbowMode;
        this.textContent = rainbowMode ? 'Disable Rainbow' : 'Rainbow Mode';
        this.style.backgroundColor = rainbowMode ? '#FF4081' : '#4CAF50';
    });
    
    document.getElementById('startGameBtn').addEventListener('click', function() {
        shapeCatcherGame.start();
    });
    
    // Setup slider value displays
    setupSliderValueUpdates();
    
    // Initial render
    renderAllShapes();
};

// Update slider value displays
function setupSliderValueUpdates() {
    const sliders = [
        { slider: 'redSlider', value: 'redValue' },
        { slider: 'greenSlider', value: 'greenValue' },
        { slider: 'blueSlider', value: 'blueValue' },
        { slider: 'sizeSlider', value: 'sizeValue' },
        { slider: 'segmentsSlider', value: 'segmentsValue' },
        { slider: 'alphaSlider', value: 'alphaValue' }
    ];
    
    sliders.forEach(item => {
        const slider = document.getElementById(item.slider);
        const valueDisplay = document.getElementById(item.value);
        
        // Update initial value
        valueDisplay.textContent = slider.value;
        
        // Add event listener for changes
        slider.addEventListener('input', function() {
            valueDisplay.textContent = this.value;
        });
    });
}

// Update button selection visual
function updateButtonSelection(selectedBtnId) {
    const buttons = ['pointsBtn', 'trianglesBtn', 'circlesBtn'];
    buttons.forEach(btnId => {
        document.getElementById(btnId).classList.remove('selected');
    });
    document.getElementById(selectedBtnId).classList.add('selected');
}