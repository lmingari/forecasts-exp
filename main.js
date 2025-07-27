import './style.css';
import GeoTIFF from 'ol/source/GeoTIFF.js';
import Map from 'ol/Map.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import View from 'ol/View.js';
import OSM from 'ol/source/OSM.js';
import {fromLonLat} from 'ol/proj';
import colormap from 'colormap';
import { fromUrl } from 'geotiff';
import TileJSON from 'ol/source/TileJSON.js';
import LayerGroup from 'ol/layer/Group.js';

let currentRasterIndex = 0;
let gLayers;

const rasterLayers = [];
for (let i = 0; i<= 72; i +=6) {
    const time = `${i.toString().padStart(3, '0')}`;
    rasterLayers.push({
        url: `SO2_col_mass_${time}.tif`,
        name: `SO2 column mass [DU] +${time}h FCST`,
    });
}

function createLayer(url) {
    const source = new GeoTIFF({
        normalize: false,
        interpolate: true,
        transition: 0,
        sources: [ { url: url, bands: [1] } ],
    });
    return new TileLayer({source: source, visible: false});
}

// Initialize the map
function initMap() {
    // Read maptiler key
    const key = import.meta.env.VITE_MAPTILER_API_KEY;
    if (!key) {
        console.error('MapTiler API key is missing! Please set VITE_MAPTILER_API_KEY in .env');
    }
    // Create basemap
    const source = new TileJSON({
      url: `https://api.maptiler.com/maps/dataviz/tiles.json?key=${key}`, // source URL
      tileSize: 512,
      crossOrigin: 'anonymous'
    });
    const basemap = new TileLayer({ source: source });
    //const basemap = new TileLayer({ source: new OSM() });
    
    // Create layer group
    const layers = rasterLayers.map(r => createLayer(r.url));
    gLayers = new LayerGroup({layers: layers});

    // Initialize map
    const map = new Map({
        target: 'map-container',
        layers: [basemap,gLayers],
        pixelRatio: 1,
        view: new View({
            center: fromLonLat([-18,65]),
            zoom: 4
        })
    });

    // Initialize UI
    updateRasterInfo();
    createColorbar();
    switchToRaster(currentRasterIndex);
}

// Switch to specific raster
function switchToRaster(index) {
    if (index < 0 || index >= rasterLayers.length) return;

    gLayers.getLayers().forEach((layer, i) => {
      layer.setVisible(i === index);
    });
 
    currentRasterIndex = index;
    updateRasterInfo();
}

// Navigation functions
function nextRaster() {
    const nextIndex = (currentRasterIndex + 1) % rasterLayers.length;
    switchToRaster(nextIndex);
}

function previousRaster() {
    const prevIndex = (currentRasterIndex - 1 + rasterLayers.length) % rasterLayers.length;
    switchToRaster(prevIndex);
}

// Update raster information display
async function updateRasterInfo() {
    const i = currentRasterIndex + 1;
    const n = rasterLayers.length;
    const url = rasterLayers[currentRasterIndex].url;

    let tiff = await fromUrl(url);
    const image = await tiff.getImage(0);
    const metadataFields = await image.getGDALMetadata();

    document.getElementById('current-raster-name').textContent = rasterLayers[currentRasterIndex].name;
    document.getElementById('current-raster-description').textContent = `Valid: ${metadataFields.time}`;
    document.getElementById('current-raster-created').textContent = `Created: ${metadataFields.created}`;
    document.getElementById('current-raster-index').textContent = `Step: ${i} / ${n}`;
}

function getColorStops(name, min, max, steps) {
  const delta = max / (steps - 1);
  const stops = new Array(steps * 2);
  const colors = colormap({
      colormap: name, 
      nshades: steps, 
      format: 'rgba',
      alpha: 0.6
  });
  for (let i = 0; i < steps; i++) {
    stops[i * 2] = i * delta;
    stops[i * 2 + 1] = colors[i];
  }
  if (min<delta) {
      stops[0] = min;
  }
  return stops;
}

// Create colorbar
function createColorbar() {
    const labelsContainer = document.getElementById('colorbar-labels');
    const titleContainer  = document.getElementById('colorbar-title');
    const colorbarCanvas  = document.getElementById('colorbar');
    const colorbarCtx = colorbarCanvas.getContext('2d');

    const minVal    = 1;
    const maxVal    = 20;
    const steps     = 11;
    const barHeight = 200;
    const barWidth  = 20;
    const segmentHeight = barHeight / steps;

    const stops = getColorStops('RdBu',minVal,maxVal,steps);
    const data = ['band', 1];
    const style = {
      color: [
        'case',
        ['<',data,minVal],
        [0,0,0,0],
        ['interpolate',
        ['linear'],
        data,
        ...stops,
        ]
      ],
    };
    gLayers.getLayers().forEach(layer => {
        layer.setStyle(style);
    });

    // Clear previous labels
    labelsContainer.innerHTML = '';

    for (let i = 0; i < steps; i++) {
      const y = barHeight - (i+1)*segmentHeight;
      const value = stops[i * 2];
      const color = stops[i * 2 + 1];

      // Draw color rectangle
      colorbarCtx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`;
      colorbarCtx.fillRect(0, y, barWidth, segmentHeight);

      // Create label
      const label = document.createElement('span');
      label.textContent = value;
      label.style.position = 'absolute';
      label.style.top = `${y + segmentHeight/2}px`;
      label.style.transform = 'translateY(-50%)';
      labelsContainer.appendChild(label);
    }

    // Update labels container style
    labelsContainer.style.position = 'relative';
    labelsContainer.style.height = `${barHeight}px`;

    titleContainer.textContent = "SO2 column mass [DU]";
}

// Event listeners
document.getElementById('prevBtn').addEventListener('click', previousRaster);
document.getElementById('nextBtn').addEventListener('click', nextRaster);

// Keyboard controls
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowLeft':
            previousRaster();
            break;
        case 'ArrowRight':
        case ' ':
            e.preventDefault();
            nextRaster();
            break;
    }
});

// Initialize the application
window.addEventListener("load", initMap);
