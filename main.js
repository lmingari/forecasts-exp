import './style.css';
import GeoTIFF from 'ol/source/GeoTIFF.js';
import Map from 'ol/Map.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import View from 'ol/View.js';
import OSM from 'ol/source/OSM.js';
import {fromLonLat} from 'ol/proj';
import XYZ from 'ol/source/XYZ.js';
import colormap from 'colormap';
import { fromUrl } from 'geotiff';

let currentRasterIndex = 0;
let map, currentLayer;

const rasterLayers = [
  {
    name: 'SO2 column mass [DU] +00h FCST',
    base: 'SO2_col_mass_000.tif',
  },
  {
    name: 'SO2 column mass [DU] +06h FCST',
    base: 'SO2_col_mass_006.tif',
  },
  {
    name: 'SO2 column mass [DU] +12h FCST',
    base: 'SO2_col_mass_012.tif',
  },
  {
    name: 'SO2 column mass [DU] +18h FCST',
    base: 'SO2_col_mass_018.tif',
  },
  {
    name: 'SO2 column mass [DU] +24h FCST',
    base: 'SO2_col_mass_024.tif',
  },
  {
    name: 'SO2 column mass [DU] +30h FCST',
    base: 'SO2_col_mass_030.tif',
  },
  {
    name: 'SO2 column mass [DU] +36h FCST',
    base: 'SO2_col_mass_036.tif',
  },
  {
    name: 'SO2 column mass [DU] +42h FCST',
    base: 'SO2_col_mass_042.tif',
  },
  {
    name: 'SO2 column mass [DU] +48h FCST',
    base: 'SO2_col_mass_048.tif',
  },
];

const data = ['band', 1];
const style = {
  color: [
    'case',
    ['<',data,1],
    [0,0,0,0],
    ['interpolate',
    ['linear'],
    data,
    ...getColorStops('RdBu',1,20,11),
    ]
  ],
};

// Create layer for the ith image
function createLayer(i) {
  const base = rasterLayers[i].base;
  const source = new GeoTIFF({
    normalize: false,
    interpolate: true,
    sources: [
        {
            url: base,
            nodata: 0,
        },
    ],
  });

  return new TileLayer({
    source: source,
    style: style,
  });
};

// Initialize the map
function initMap() {
//    const osm = new TileLayer({
//        source: new OSM(),
//    });

    const carto = new TileLayer({
      source: new XYZ({
        url: 'http://{1-4}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        attributions: 'MaL</a>.'
      }),
      properties: { name: 'baseMap' }
    });

    currentLayer = createLayer(currentRasterIndex);

    // Initialize map
    map = new Map({
        target: 'map-container',
        layers: [carto,currentLayer],
        view: new View({
            center: fromLonLat([-18,65]),
            zoom: 4
        })
    });

    // Initialize UI
    updateRasterInfo();
    createColorbar();
}

// Switch to specific raster
function switchToRaster(index) {
    if (index < 0 || index >= rasterLayers.length) return;

    currentRasterIndex = index;

    // Remove current layer
    map.removeLayer(currentLayer);

    // Add new layer
    currentLayer = createLayer(currentRasterIndex);
    map.addLayer(currentLayer);

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
    const currentRaster = rasterLayers[currentRasterIndex];

    const metadataFields = await getCustomMetadataFields();

    document.getElementById('current-raster-name').textContent = currentRaster.name;
    document.getElementById('current-raster-description').textContent = `Valid: ${metadataFields.time}`;
    document.getElementById('current-raster-index').textContent = `${i} / ${n}`;
}

async function getCustomMetadataFields() {
    let tiff;
    const base = rasterLayers[currentRasterIndex].base;
    tiff = await fromUrl(base);
    const image = await tiff.getImage(0);
    return image.getGDALMetadata();
};

function getColorStops(name, min, max, steps) {
  const delta = max / (steps - 1);
  const stops = new Array(steps * 2);
  const colors = colormap({
      colormap: name, 
      nshades: steps, 
      format: 'rgba',
      alpha: 0.5
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
    const colorbarCanvas = document.getElementById('colorbar');
    const colorbarCtx = colorbarCanvas.getContext('2d');
    const labelsContainer = document.getElementById('colorbar-labels');


    const minValue = 1;
    const maxValue = 20;
    const steps = 11;
    
    const barHeight = 200;
    const barWidth = 20;
    const segmentHeight = barHeight / steps;

    // Clear previous labels
    labelsContainer.innerHTML = '';

    const stops = getColorStops('RdBu',minValue,maxValue,steps)
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
window.onload = initMap;
