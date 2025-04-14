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
        
        // Adjust minimum distance based on shape type
        let minDistance = 0.005; // Default minimum distance
        
        if (currentShapeType === 'triangle') {
            // Increase minimum distance for triangles to avoid overcrowding
            minDistance = 0.03; // Adjust this value as needed
        }
        
        // Only add a shape if we've moved a minimum distance (prevents too many shapes)
        if (distance > minDistance) {
            // For continuous line drawing
            if (currentShapeType === 'point') {
                // Create line for continuous point drawing
                shapesList.push(new Line(
                    lastMousePos.x, lastMousePos.y,
                    currentPos.x, currentPos.y,
                    color, size / 10, alpha
                ));
            }
            
            // Add the main shape based on current type
            addShape(currentPos.x, currentPos.y, color, size, segments, alpha, dx, dy);
            
            // Update last position
            lastMousePos = { ...currentPos };
            
            // Render all shapes
            renderAllShapes();
        }
    } else {
        // For single clicks, just add the shape
        addShape(coords.x, coords.y, color, size, segments, alpha);
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
                // Calculate perpendicular direction and normalize it
                const magnitude = Math.sqrt(dx*dx + dy*dy);
                const normalizedDx = dx / magnitude;
                const normalizedDy = dy / magnitude;
                
                const perpX = -normalizedDy;
                const perpY = normalizedDx;
                
                // Create oriented triangle vertices with fixed size (not dependent on dx/dy magnitude)
                const triSize = size / 100;
                const vertices = [
                    [x, y], // Tip of the triangle
                    [x - triSize * normalizedDx + triSize * perpX, y - triSize * normalizedDy + triSize * perpY],
                    [x - triSize * normalizedDx - triSize * perpX, y - triSize * normalizedDy - triSize * perpY]
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

// Modify or replace your existing drawPicture() function
function drawPicture() {
    // Clear out any existing shapes on the canvas.
    shapesList = [];

    // Option 1: Randomly pick a scene each time.
    const sceneChoice = Math.floor(Math.random() * 4); 
    // 0 => Forest scene
    // 1 => Beach scene
    // 2 => Mountain scene
    // 3 => Moonlit scene

    switch(sceneChoice) {
        case 0:
            drawForestScene();
            break;
        case 1:
            drawBeachScene();
            break;
        case 2:
            drawMountainScene();
            break;
        case 3:
            drawMoonlitScene();
            break;
    }

    // Finally, render all shapes on the canvas
    renderAllShapes();
}

/***********************
 * HELPER SCENE FUNCTIONS
 ***********************/

/** 
 * 1) Example: Forest Scene
 *    Similar to your original tree scene, but we'll add 
 *    a couple of extra trees or variations.
 */
function drawForestScene() {
    // Sky
    shapesList.push(new Triangle(
        [[-1.0, 1.0], [1.0, 1.0], [-1.0, -0.3]],
        [0.6, 0.8, 1.0], 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[1.0, 1.0], [1.0, -0.3], [-1.0, -0.3]],
        [0.6, 0.8, 1.0], 10, 1.0
    ));

    // Ground
    shapesList.push(new Triangle(
        [[-1.0, -0.3], [1.0, -0.3], [-1.0, -1.0]],
        [0.4, 0.8, 0.3], 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[1.0, -1.0], [1.0, -0.3], [-1.0, -1.0]],
        [0.4, 0.8, 0.3], 10, 1.0
    ));

    // Tree 1 (center)
    drawSimpleTree(0.0, -0.3);

    // Tree 2 (left)
    drawSimpleTree(-0.6, -0.3);

    // Tree 3 (right)
    drawSimpleTree(0.6, -0.3);

    // Optional: Clouds or birds
    // Clouds
    const cloudColor = [1.0, 1.0, 1.0];
    shapesList.push(new Circle(-0.7, 0.7, cloudColor, 25, 16, 0.8));
    shapesList.push(new Circle(-0.5, 0.7, cloudColor, 30, 16, 0.8));
    
    // Birds
    const birdColor = [0.3, 0.3, 0.3];
    shapesList.push(new Triangle(
        [[-0.8, 0.4], [-0.7, 0.5], [-0.9, 0.5]],
        birdColor, 10, 0.7
    ));
    shapesList.push(new Triangle(
        [[-0.6, 0.4], [-0.7, 0.5], [-0.8, 0.4]],
        birdColor, 10, 0.7
     ));
}

/**
 * 2) Beach Scene
 *    Includes sky, ocean, and sand, plus a sun or palm tree.
 */
function drawBeachScene() {
    // Sky
    shapesList.push(new Triangle(
        [[-1.0, 1.0], [1.0, 1.0], [-1.0, 0.0]],
        [0.6, 0.8, 1.0], 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[1.0, 1.0], [1.0, 0.0], [-1.0, 0.0]],
        [0.6, 0.8, 1.0], 10, 1.0
    ));

    // Ocean (blue band)
    shapesList.push(new Triangle(
        [[-1.0, 0.0], [1.0, 0.0], [-1.0, -0.3]],
        [0.2, 0.4, 0.8], 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[1.0, -0.3], [1.0, 0.0], [-1.0, -0.3]],
        [0.2, 0.4, 0.8], 10, 1.0
    ));
    
    // Sand (light tan)
    shapesList.push(new Triangle(
        [[-1.0, -1.0], [1.0, -1.0], [-1.0, -0.3]],
        [0.94, 0.86, 0.67], 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[1.0, -0.3], [1.0, -1.0], [-1.0, -0.3]],
        [0.94, 0.86, 0.67], 10, 1.0
    ));

    // Sun (Circle)
    shapesList.push(new Circle(0.8, 0.8, [1.0, 0.9, 0.0], 30, 24, 1.0));

    // Palm tree
    const trunkColor = [0.6, 0.4, 0.2];
    // Trunk
    shapesList.push(new Triangle(
        [[-0.6, -0.3], [-0.6, 0.0], [-0.5, 0.0]],
        trunkColor, 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[-0.6, -0.3], [-0.5, -0.3], [-0.5, 0.0]],
        trunkColor, 10, 1.0
    ));
    
    // Palm leaves
    const leafColor = [0.0, 0.6, 0.0];
    shapesList.push(new Triangle(
        [[-0.55, 0.0], [-0.8, 0.2], [-0.3, 0.2]],
        leafColor, 10, 0.9
    ));
    shapesList.push(new Triangle(
        [[-0.55, 0.0], [-0.9, 0.1], [-0.7, 0.0]],
        leafColor, 10, 0.9
    ));
    shapesList.push(new Triangle(
        [[-0.55, 0.0], [-0.2, 0.1], [-0.4, 0.0]],
        leafColor, 10, 0.9
    ));
    shapesList.push(new Triangle(
        [[-0.55, 0.0], [-0.7, -0.1], [-0.4, -0.1]],
        leafColor, 10, 0.9
    ));
}

/**
 * 3) Mountain Scene
 *    Overlapping triangles of different colors to create a mountain range.
 */
function drawMountainScene() {
    // Light sky background
    shapesList.push(new Triangle(
        [[-1.0, 1.0], [1.0, 1.0], [-1.0, -0.5]],
        [0.6, 0.8, 1.0], 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[1.0, 1.0], [1.0, -0.5], [-1.0, -0.5]],
        [0.6, 0.8, 1.0], 10, 1.0
    ));

    // Distant mountains
    shapesList.push(new Triangle(
        [[-1.0, -0.5], [-0.4, 0.4], [0.2, -0.5]],
        [0.3, 0.3, 0.3], 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[-0.2, -0.5], [0.5, 0.5], [1.0, -0.5]],
        [0.35, 0.35, 0.35], 10, 1.0
    ));

    // Foreground ground
    shapesList.push(new Triangle(
        [[-1.0, -0.5], [1.0, -0.5], [-1.0, -1.0]],
        [0.4, 0.7, 0.4], 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[1.0, -1.0], [1.0, -0.5], [-1.0, -1.0]],
        [0.4, 0.7, 0.4], 10, 1.0
    ));
    
    // Snow caps
    shapesList.push(new Triangle(
        [[-0.48, 0.25], [-0.4, 0.4], [-0.32, 0.25]],
        [1.0, 1.0, 1.0], 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[0.42, 0.35], [0.5, 0.5], [0.58, 0.35]],
        [1.0, 1.0, 1.0], 10, 1.0
    ));
    
    // Add a small lake
    shapesList.push(new Circle(0.0, -0.7, [0.1, 0.3, 0.8], 30, 24, 0.8));
}

/**
 * 4) Moonlit Scene
 *    Dark sky, moon, a few stars, maybe silhouettes of trees.
 */
function drawMoonlitScene() {
    // Dark sky
    shapesList.push(new Triangle(
        [[-1.0, 1.0], [1.0, 1.0], [-1.0, -1.0]],
        [0.05, 0.05, 0.2], 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[1.0, 1.0], [1.0, -1.0], [-1.0, -1.0]],
        [0.05, 0.05, 0.2], 10, 1.0
    ));

    // Moon (white-yellow circle)
    shapesList.push(new Circle(0.7, 0.7, [1.0, 0.95, 0.8], 40, 24, 1.0));

    // Stars: small circles or points
    shapesList.push(new Circle(-0.8, 0.9, [1.0, 1.0, 1.0], 5, 12, 1.0));
    shapesList.push(new Circle(-0.2, 0.8, [1.0, 1.0, 1.0], 5, 12, 1.0));
    shapesList.push(new Circle(0.2, 0.9, [1.0, 1.0, 1.0], 5, 12, 1.0));
    shapesList.push(new Circle(0.9, 0.6, [1.0, 1.0, 1.0], 5, 12, 1.0));

    // Silhouette ground
    shapesList.push(new Triangle(
        [[-1.0, -0.6], [1.0, -0.6], [-1.0, -1.0]],
        [0.1, 0.1, 0.1], 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[1.0, -1.0], [1.0, -0.6], [-1.0, -1.0]],
        [0.1, 0.1, 0.1], 10, 1.0
    ));

    // Silhouette trees
    drawSimpleTree(-0.5, -0.6, [0.1, 0.1, 0.1], [0.1, 0.15, 0.1]);
    drawSimpleTree(0.3, -0.6, [0.1, 0.1, 0.1], [0.1, 0.15, 0.1]);
    drawSimpleTree(-0.2, -0.6, [0.1, 0.1, 0.1], [0.1, 0.15, 0.1]);
    drawSimpleTree(0.7, -0.6, [0.1, 0.1, 0.1], [0.1, 0.15, 0.1]);
}

/**
 * Helper to draw a simple tree at (x, y). 
 * Optionally pass in color for trunk/foliage if you want variation.
 */
function drawSimpleTree(x, y, trunkColor = [0.6, 0.4, 0.2], leavesColor = [0.2, 0.8, 0.2]) {
    // Trunk (two triangles to form a rectangle)
    shapesList.push(new Triangle(
        [[x - 0.05, y], [x - 0.05, y + 0.2], [x + 0.05, y + 0.2]],
        trunkColor, 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[x - 0.05, y], [x + 0.05, y,], [x + 0.05, y + 0.2]],
        trunkColor, 10, 1.0
    ));

    // Foliage (three triangles, stacked)
    shapesList.push(new Triangle(
        [[x, y + 0.5], [x - 0.15, y + 0.2], [x + 0.15, y + 0.2]],
        leavesColor, 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[x, y + 0.35], [x - 0.12, y + 0.15], [x + 0.12, y + 0.15]],
        leavesColor, 10, 1.0
    ));
    shapesList.push(new Triangle(
        [[x, y + 0.25], [x - 0.1, y + 0.05], [x + 0.1, y + 0.05]],
        leavesColor, 10, 1.0
    ));
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
    
    // Remove any existing mouse event listeners (if there are any)
    canvas.removeEventListener('mousedown', null);
    canvas.removeEventListener('mousemove', null);
    canvas.removeEventListener('mouseup', null);
    canvas.removeEventListener('mouseleave', null);

    // Flag to track mouse state
    isMouseDown = false;

    // Setup fresh event listeners
    canvas.addEventListener('mousedown', function(event) {
        console.log("Mouse down - starting to draw");
        isMouseDown = true;
        handleMouseEvent(event);
    });

    canvas.addEventListener('mousemove', function(event) {
        // Only draw when mouse is down
        if (isMouseDown) {
            console.log("Mouse move with button down - drawing");
            handleMouseEvent(event, true);
        } else {
            console.log("Mouse move without button - not drawing");
        }
    });

    canvas.addEventListener('mouseup', function() {
        console.log("Mouse up - stopping drawing");
        isMouseDown = false;
    });

    canvas.addEventListener('mouseleave', function() {
        console.log("Mouse left canvas - stopping drawing");
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
        
        // Set both reference images
        document.getElementById('lineDrawingReference').src = 'Frylock linework.jpg';
        document.getElementById('colorReference').src = 'Frylock reference.png';
    });
    
    // Add event listeners for the advanced feature buttons
    document.getElementById('downloadBtn').addEventListener('click', function() {
        saveCanvasAsImage();
    });
    
    document.getElementById('rainbowModeBtn').addEventListener('click', function() {
        rainbowMode = !rainbowMode;
        this.textContent = rainbowMode ? 'Disable Rainbow' : 'Rainbow Mode';
        this.style.backgroundColor = rainbowMode ? '#FF4081' : '#4CAF50';
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
        
        if (slider && valueDisplay) {
            // Update initial value
            valueDisplay.textContent = slider.value;
            
            // Add event listener for changes
            slider.addEventListener('input', function() {
                valueDisplay.textContent = this.value;
            });
        }
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

// Simple mini-game functionality
document.getElementById('startGameBtn').addEventListener('click', function() {
    alert("Starting Shape Catcher mini-game!");
    
    // Save current state to restore later
    const savedShapes = [...shapesList];
    
    // Clear canvas for the game
    shapesList = [];
    renderAllShapes();
    
    // Game variables
    let score = 0;
    let gameTime = 30; // seconds
    let gameActive = true;
    let fallingShapes = [];
    
    // Create game UI
    const gameUI = document.createElement('div');
    gameUI.id = 'gameUI';
    gameUI.style.position = 'absolute';
    gameUI.style.top = '20px';
    gameUI.style.left = '50%';
    gameUI.style.transform = 'translateX(-50%)';
    gameUI.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    gameUI.style.color = 'white';
    gameUI.style.padding = '10px';
    gameUI.style.borderRadius = '5px';
    gameUI.style.zIndex = '1000';
    
    const scoreDisplay = document.createElement('div');
    scoreDisplay.textContent = 'Score: 0';
    gameUI.appendChild(scoreDisplay);
    
    const timeDisplay = document.createElement('div');
    timeDisplay.textContent = 'Time: 30s';
    gameUI.appendChild(timeDisplay);
    
    document.body.appendChild(gameUI);
    
    // Create a basket
    const basket = {
        x: 0,
        y: -0.8,
        width: 0.2,
        height: 0.1
    };
    
    // Move basket with mouse
    function moveBasket(event) {
        if (!gameActive) return;
        
        const coords = canvasToGLCoord(event.clientX, event.clientY);
        basket.x = coords.x;
    }
    
    canvas.addEventListener('mousemove', moveBasket);
    
    // Spawn a falling shape
    function spawnShape() {
        const x = Math.random() * 1.8 - 0.9;
        const y = 1.0;
        
        const r = Math.random();
        const g = Math.random();
        const b = Math.random();
        
        fallingShapes.push({
            x: x,
            y: y,
            type: Math.random() > 0.5 ? 'circle' : 'triangle',
            color: [r, g, b],
            size: Math.random() * 15 + 5,
            speed: Math.random() * 0.01 + 0.005
        });
    }
    
    // Update and render the game
    function gameLoop() {
        if (!gameActive) return;
        
        // Clear canvas
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Draw basket
        const basketVertices = [
            [basket.x - basket.width/2, basket.y - basket.height/2],
            [basket.x - basket.width/2, basket.y + basket.height/2],
            [basket.x + basket.width/2, basket.y + basket.height/2],
            
            [basket.x - basket.width/2, basket.y - basket.height/2],
            [basket.x + basket.width/2, basket.y + basket.height/2],
            [basket.x + basket.width/2, basket.y - basket.height/2]
        ];
        
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(basketVertices.flat()), gl.STATIC_DRAW);
        gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);
        gl.vertexAttrib4f(a_Color, 1.0, 1.0, 1.0, 1.0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.disableVertexAttribArray(a_Position);
        
        // Update falling shapes
        for (let i = fallingShapes.length - 1; i >= 0; i--) {
            const shape = fallingShapes[i];
            
            // Move shape down
            shape.y -= shape.speed;
            
            // Draw shape
            if (shape.type === 'circle') {
                new Circle(shape.x, shape.y, shape.color, shape.size, 12, 1.0).render();
            } else {
                const sideLength = shape.size / 100;
                const height = sideLength * Math.sqrt(3) / 2;
                
                const vertices = [
                    [shape.x, shape.y + height/2],
                    [shape.x - sideLength/2, shape.y - height/2],
                    [shape.x + sideLength/2, shape.y - height/2]
                ];
                
                new Triangle(vertices, shape.color, shape.size, 1.0).render();
            }
            
            // Check if caught by basket
            if (shape.y <= basket.y + basket.height/2 && 
                shape.y >= basket.y - basket.height/2 &&
                shape.x >= basket.x - basket.width/2 &&
                shape.x <= basket.x + basket.width/2) {
                
                // Caught! Add score
                score += 10;
                scoreDisplay.textContent = `Score: ${score}`;
                
                // Remove shape
                fallingShapes.splice(i, 1);
                continue;
            }
            
            // Remove shapes that are off-screen
            if (shape.y < -1.2) {
                fallingShapes.splice(i, 1);
            }
        }
        
        // Occasionally spawn new shapes
        if (Math.random() < 0.05) {
            spawnShape();
        }
        
        // Update game time
        gameTime -= 1/60; // Assuming 60fps
        if (gameTime <= 0) {
            endGame();
            return;
        }
        
        timeDisplay.textContent = `Time: ${Math.ceil(gameTime)}s`;
        
        // Continue game loop
        requestAnimationFrame(gameLoop);
    }
    
    function endGame() {
        gameActive = false;
        
        // Show final score
        alert(`Game Over! Your score: ${score}`);
        
        // Remove game UI
        document.body.removeChild(gameUI);
        
        // Remove event listener
        canvas.removeEventListener('mousemove', moveBasket);
        
        // Restore previous canvas state
        shapesList = savedShapes;
        renderAllShapes();
    }
    
    // Start the game loop
    gameLoop();
});