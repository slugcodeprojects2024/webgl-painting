/**
 * Advanced features for WebGL Painting Application
 * These features add extra functionality beyond the basic requirements
 */

// Particle System for special effects
class ParticleSystem {
    constructor(x, y, color, count = 20) {
        this.particles = [];
        this.lifetime = 0;
        this.maxLifetime = 60; // frames
        
        // Create particles
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.01 + 0.005;
            const size = Math.random() * 5 + 2;
            const lifetime = Math.random() * 50 + 10;
            
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: size,
                color: [...color, 1.0],
                lifetime: lifetime,
                maxLifetime: lifetime
            });
        }
    }
    
    update() {
        this.lifetime++;
        
        // Update each particle
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            
            // Move particle
            p.x += p.vx;
            p.y += p.vy;
            
            // Apply gravity
            p.vy -= 0.0002;
            
            // Update lifetime
            p.lifetime--;
            
            // Update alpha based on lifetime
            p.color[3] = p.lifetime / p.maxLifetime;
        }
        
        // Filter out dead particles
        this.particles = this.particles.filter(p => p.lifetime > 0);
    }
    
    render() {
        for (const p of this.particles) {
            // Draw particle as a point
            gl.vertexAttrib3f(a_Position, p.x, p.y, 0.0);
            gl.vertexAttrib4f(a_Color, p.color[0], p.color[1], p.color[2], p.color[3]);
            gl.uniform1f(u_PointSize, p.size);
            gl.drawArrays(gl.POINTS, 0, 1);
        }
    }
    
    isAlive() {
        return this.particles.length > 0 && this.lifetime < this.maxLifetime;
    }
}

// Class for animated brush stroke
class AnimatedStroke {
    constructor(path, color, size, duration = 30) {
        this.path = path; // Array of points
        this.color = color;
        this.size = size;
        this.progress = 0;
        this.duration = duration;
        this.finished = false;
    }
    
    update() {
        if (this.progress < this.duration) {
            this.progress++;
        } else {
            this.finished = true;
        }
    }
    
    render() {
        const pointCount = this.path.length;
        const progressRatio = this.progress / this.duration;
        const pointsToRender = Math.floor(pointCount * progressRatio);
        
        // Nothing to render yet
        if (pointsToRender < 2) return;
        
        // Create a line strip from the rendered points
        const vertices = this.path.slice(0, pointsToRender);
        const verticesFlat = vertices.flat();
        
        // Create buffer object
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verticesFlat), gl.STATIC_DRAW);
        
        // Assign buffer to a_Position and enable it
        gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);
        
        // Set color
        gl.vertexAttrib4f(a_Color, this.color[0], this.color[1], this.color[2], 1.0);
        gl.lineWidth(this.size / 10);
        
        // Draw the line strip
        gl.drawArrays(gl.LINE_STRIP, 0, vertices.length);
        
        // Clean up
        gl.disableVertexAttribArray(a_Position);
        gl.deleteBuffer(vertexBuffer);
    }
}

// Animation manager
class AnimationManager {
    constructor() {
        this.particleSystems = [];
        this.animatedStrokes = [];
        this.isAnimating = false;
        this.frameId = null;
    }
    
    addParticleSystem(x, y, color, count = 20) {
        const ps = new ParticleSystem(x, y, color, count);
        this.particleSystems.push(ps);
        this.startAnimation();
    }
    
    addAnimatedStroke(path, color, size, duration = 30) {
        const stroke = new AnimatedStroke(path, color, size, duration);
        this.animatedStrokes.push(stroke);
        this.startAnimation();
    }
    
    startAnimation() {
        if (!this.isAnimating) {
            this.isAnimating = true;
            this.animate();
        }
    }
    
    animate() {
        // Update and render animations
        let hasActiveAnimations = false;
        
        // Update particle systems
        for (let i = 0; i < this.particleSystems.length; i++) {
            const ps = this.particleSystems[i];
            ps.update();
            
            if (ps.isAlive()) {
                hasActiveAnimations = true;
            }
        }
        
        // Update animated strokes
        for (let i = 0; i < this.animatedStrokes.length; i++) {
            const stroke = this.animatedStrokes[i];
            stroke.update();
            
            if (!stroke.finished) {
                hasActiveAnimations = true;
            }
        }
        
        // Render all shapes and animations
        renderAnimationFrame();
        
        // Continue animation if needed
        if (hasActiveAnimations) {
            this.frameId = requestAnimationFrame(() => this.animate());
        } else {
            this.isAnimating = false;
            this.particleSystems = this.particleSystems.filter(ps => ps.isAlive());
            this.animatedStrokes = this.animatedStrokes.filter(stroke => !stroke.finished);
        }
    }
    
    stopAnimation() {
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
        this.isAnimating = false;
    }
}

// Function to render all shapes and animations
function renderAnimationFrame() {
    // Clear canvas
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Render each shape
    for (const shape of shapesList) {
        shape.render();
    }
    
    // Render particle systems
    for (const ps of animationManager.particleSystems) {
        ps.render();
    }
    
    // Render animated strokes
    for (const stroke of animationManager.animatedStrokes) {
        stroke.render();
    }
}

// Create a path for mouse movement
function recordMousePath(startX, startY, endX, endY, steps = 10) {
    const path = [];
    
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = startX + (endX - startX) * t;
        const y = startY + (endY - startY) * t;
        path.push([x, y]);
    }
    
    return path;
}

// Simple mini-game: catch falling shapes
class ShapeCatcherGame {
    constructor() {
        this.active = false;
        this.score = 0;
        this.fallingShapes = [];
        this.basket = {
            x: 0,
            y: -0.8,
            width: 0.2,
            height: 0.1
        };
        this.frameId = null;
        this.spawnRate = 60; // frames between spawns
        this.frameCount = 0;
        this.gameTime = 0;
        this.gameLength = 30; // seconds
        this.scoreElement = null;
        this.timeElement = null;
    }
    
    start() {
        if (this.active) return;
        
        // Clear canvas for the game
        shapesList = [];
        
        // Create UI for game
        this.createGameUI();
        
        // Reset game state
        this.active = true;
        this.score = 0;
        this.fallingShapes = [];
        this.frameCount = 0;
        this.gameTime = 0;
        
        // Start game loop
        this.lastFrameTime = performance.now();
        this.gameLoop();
    }
    
    createGameUI() {
        // Create score display
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
        gameUI.style.fontFamily = 'Arial, sans-serif';
        gameUI.style.zIndex = '1000';
        
        this.scoreElement = document.createElement('div');
        this.scoreElement.textContent = 'Score: 0';
        gameUI.appendChild(this.scoreElement);
        
        this.timeElement = document.createElement('div');
        this.timeElement.textContent = 'Time: 30s';
        gameUI.appendChild(this.timeElement);
        
        document.body.appendChild(gameUI);
        
        // Add event listener for mouse movement to control basket
        canvas.addEventListener('mousemove', this.moveBasket.bind(this));
    }
    
    removeGameUI() {
        const gameUI = document.getElementById('gameUI');
        if (gameUI) {
            document.body.removeChild(gameUI);
        }
        
        // Remove event listener
        canvas.removeEventListener('mousemove', this.moveBasket.bind(this));
    }
    
    moveBasket(event) {
        if (!this.active) return;
        
        const coords = canvasToGLCoord(event.clientX, event.clientY);
        this.basket.x = coords.x;
    }
    
    spawnShape() {
        // Random position at top of screen
        const x = Math.random() * 1.8 - 0.9;
        const y = 1.0;
        
        // Random shape type
        const types = ['circle', 'triangle'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        // Random color
        const color = [
            Math.random(),
            Math.random(),
            Math.random()
        ];
        
        // Random size
        const size = Math.random() * 15 + 5;
        
        // Add to falling shapes
        this.fallingShapes.push({
            x: x,
            y: y,
            type: type,
            color: color,
            size: size,
            speed: Math.random() * 0.01 + 0.005,
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 0.1
        });
    }
    
    updateShapes() {
        for (let i = 0; i < this.fallingShapes.length; i++) {
            const shape = this.fallingShapes[i];
            
            // Move shape down
            shape.y -= shape.speed;
            
            // Rotate shape
            shape.rotation += shape.rotationSpeed;
            
            // Check if shape is caught by basket
            if (shape.y <= this.basket.y + this.basket.height/2 && 
                shape.y >= this.basket.y - this.basket.height/2 &&
                shape.x >= this.basket.x - this.basket.width/2 &&
                shape.x <= this.basket.x + this.basket.width/2) {
                
                // Caught! Add score
                this.score += 10;
                this.scoreElement.textContent = `Score: ${this.score}`;
                
                // Remove shape
                this.fallingShapes.splice(i, 1);
                i--;
                
                // Add particles for visual feedback
                animationManager.addParticleSystem(shape.x, shape.y, shape.color, 30);
                
                continue;
            }
            
            // Remove shapes that are off-screen
            if (shape.y < -1.2) {
                this.fallingShapes.splice(i, 1);
                i--;
            }
        }
    }
    
    renderGame() {
        // Clear canvas
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Draw basket
        const basketVertices = [
            [this.basket.x - this.basket.width/2, this.basket.y - this.basket.height/2],
            [this.basket.x - this.basket.width/2, this.basket.y + this.basket.height/2],
            [this.basket.x + this.basket.width/2, this.basket.y + this.basket.height/2],
            
            [this.basket.x - this.basket.width/2, this.basket.y - this.basket.height/2],
            [this.basket.x + this.basket.width/2, this.basket.y + this.basket.height/2],
            [this.basket.x + this.basket.width/2, this.basket.y - this.basket.height/2]
        ];
        
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(basketVertices.flat()), gl.STATIC_DRAW);
        gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);
        gl.vertexAttrib4f(a_Color, 1.0, 1.0, 1.0, 1.0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.disableVertexAttribArray(a_Position);
        gl.deleteBuffer(vertexBuffer);
        
        // Draw each falling shape
        for (const shape of this.fallingShapes) {
            if (shape.type === 'circle') {
                const circle = new Circle(shape.x, shape.y, shape.color, shape.size, 12, 1.0);
                circle.render();
            } else if (shape.type === 'triangle') {
                // Calculate rotated triangle vertices
                const sideLength = shape.size / 100;
                const height = sideLength * Math.sqrt(3) / 2;
                
                const cos = Math.cos(shape.rotation);
                const sin = Math.sin(shape.rotation);
                
                const vertices = [
                    [
                        shape.x + (0 * cos - height/2 * sin),
                        shape.y + (0 * sin + height/2 * cos)
                    ],
                    [
                        shape.x + (-sideLength/2 * cos - (-height/2) * sin),
                        shape.y + (-sideLength/2 * sin + (-height/2) * cos)
                    ],
                    [
                        shape.x + (sideLength/2 * cos - (-height/2) * sin),
                        shape.y + (sideLength/2 * sin + (-height/2) * cos)
                    ]
                ];
                
                const triangle = new Triangle(vertices, shape.color, shape.size, 1.0);
                triangle.render();
            }
        }
        
        // Render particle systems for visual effects
        for (const ps of animationManager.particleSystems) {
            ps.render();
        }
    }
    
    gameLoop() {
        if (!this.active) return;
        
        // Calculate delta time
        const now = performance.now();
        const deltaTime = now - this.lastFrameTime;
        this.lastFrameTime = now;
        
        // Update game time
        this.gameTime += deltaTime / 1000; // convert ms to seconds
        const timeLeft = Math.max(0, this.gameLength - Math.floor(this.gameTime));
        this.timeElement.textContent = `Time: ${timeLeft}s`;
        
        // Check if game is over
        if (this.gameTime >= this.gameLength) {
            this.endGame();
            return;
        }
        
        // Spawn new shapes
        this.frameCount++;
        if (this.frameCount >= this.spawnRate) {
            this.spawnShape();
            this.frameCount = 0;
            // Gradually increase difficulty
            this.spawnRate = Math.max(30, this.spawnRate - 1);
        }
        
        // Update shapes
        this.updateShapes();
        
        // Update particle systems
        animationManager.particleSystems.forEach(ps => ps.update());
        animationManager.particleSystems = animationManager.particleSystems.filter(ps => ps.isAlive());
        
        // Render game
        this.renderGame();
        
        // Continue game loop
        this.frameId = requestAnimationFrame(() => this.gameLoop());
    }
    
    endGame() {
        this.active = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
        
        // Show final score
        alert(`Game Over! Your score: ${this.score}`);
        
        // Remove game UI
        this.removeGameUI();
        
        // Clear falling shapes
        this.fallingShapes = [];
        
        // Reset canvas
        renderAllShapes();
    }
}

// Initialize animation manager
const animationManager = new AnimationManager();

// Initialize game
const shapeCatcherGame = new ShapeCatcherGame();

// Function to add animated stroke
function addAnimatedStroke(startX, startY, endX, endY, color, size) {
    const path = recordMousePath(startX, startY, endX, endY, 20);
    animationManager.addAnimatedStroke(path, color, size);
}

// Export functions to be used in main.js
window.addAnimatedStroke = addAnimatedStroke;
window.animationManager = animationManager;
window.shapeCatcherGame = shapeCatcherGame;