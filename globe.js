import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';

// Set up the scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // Set background to black
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: "high-performance",
    alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Load an equirectangular texture for the globe
const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
    console.log(`Loading file: ${url}.\nLoaded ${itemsLoaded} of ${itemsTotal} files.`);
};

const textureLoader = new THREE.TextureLoader(loadingManager);
const earthTexture = textureLoader.load('./your_texture.jpg', texture => {
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
});

// Create a sphere with the texture and higher polygon count
const geometry = new THREE.SphereGeometry(10, 512, 512); // Much higher detail with 512 segments
const material = new THREE.MeshBasicMaterial({ map: earthTexture });
const sphere = new THREE.Mesh(geometry, material);
scene.add(sphere);

// Set initial rotation to align the texture
sphere.rotation.y = Math.PI; // This flips the texture so that Greenwich/Prime Meridian is in the right spot

// Position the camera

camera.position.z = 30;

// Get the slider element
const rotationSpeedSlider = document.getElementById('rotationSpeed');

// Variables for custom controls
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// Mouse down event
document.addEventListener('mousedown', (event) => {
    isDragging = true;
});

// Mouse up event
document.addEventListener('mouseup', () => {
    isDragging = false;
});

// Mouse move event
document.addEventListener('mousemove', (event) => {
    if (isDragging) {
        const deltaMove = {
            x: event.offsetX - previousMousePosition.x,
            y: event.offsetY - previousMousePosition.y
        };

        const rotationSpeed = 0.005;
        sphere.rotation.y += deltaMove.x * rotationSpeed;
        sphere.rotation.x += deltaMove.y * rotationSpeed;
    }

    previousMousePosition = {
        x: event.offsetX,
        y: event.offsetY
    };
});

// Zoom functionality
function onDocumentMouseWheel(event) {
    const zoomSpeed = 0.1;
    camera.position.z += event.deltaY * zoomSpeed;
    camera.position.z = Math.max(15, Math.min(100, camera.position.z)); // Adjust clamp values
}

document.addEventListener('wheel', onDocumentMouseWheel, false);

// Add this shader code at the top of your file
const columnVertexShader = `
varying float vHeight;
void main() {
    vHeight = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const columnFragmentShader = `
varying float vHeight;
void main() {
    float intensity = 1.0 - (vHeight / 5.0);
    gl_FragColor = vec4(1.0, 1.0, 1.0, intensity * 0.8);
}
`;

// Load coordinates from JSON and add points to the globe
fetch('./coordinates.json')
    .then(response => response.json())
    .then(data => {
        data.forEach(coord => {
            const { latitude, longitude } = coord;
            const latRad = latitude * (Math.PI / 180);
            const lonRad = -longitude * (Math.PI / 180);
            
            const radius = 10;
            const x = radius * Math.cos(latRad) * Math.cos(lonRad);
            const y = radius * Math.sin(latRad);
            const z = radius * Math.cos(latRad) * Math.sin(lonRad);

            // Create position vector
            const position = new THREE.Vector3(x, y, z);
            
            // Calculate the normal vector (points directly outward from sphere surface)
            const normal = position.clone().normalize();
            
            const columnHeight = 5;
            const columnGeometry = new THREE.CylinderGeometry(0.03, 0.03, columnHeight, 8);
            columnGeometry.translate(0, columnHeight/2, 0);

            const columnMaterial = new THREE.ShaderMaterial({
                vertexShader: columnVertexShader,
                fragmentShader: columnFragmentShader,
                transparent: true,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
            });

            const column = new THREE.Mesh(columnGeometry, columnMaterial);
            column.position.copy(position);
            
            // Calculate the rotation to align with the normal vector
            const quaternion = new THREE.Quaternion();
            const up = new THREE.Vector3(0, 1, 0);
            quaternion.setFromUnitVectors(up, normal);
            column.setRotationFromQuaternion(quaternion);
            
            sphere.add(column);
        });
    })
    .catch(error => console.error('Error loading JSON:', error));

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    const rotationSpeed = parseFloat(rotationSpeedSlider.value);
    sphere.rotation.y += rotationSpeed; // Rotate the sphere based on slider value
    renderer.render(scene, camera);
}
animate();