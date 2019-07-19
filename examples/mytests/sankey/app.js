/* global window */
import React, {Component} from 'react';
import {render} from 'react-dom';
import {StaticMap} from 'react-map-gl';
import {AmbientLight, PointLight, LightingEffect} from '@deck.gl/core';
import DeckGL from '@deck.gl/react';
import {PathLayer} from '@deck.gl/layers';
import {GeoJsonLayer} from 'deck.gl';
import './style.css';

let _ = require('underscore');
// Set your mapbox token here
const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFyaXNiYWwiLCJhIjoiY2pzbmR0cTU1MGI4NjQzbGl5eTBhZmZrZCJ9.XN4kLWt5YzqmGQYVpFFqKw";

let i = 0;

const frameIds = ['od', 'candTours', 'finalTours'];
//const frames = require(`./inputs/frames_${sampleSize}pct.json`);
const frames = require('./inputs/frames.json');
const zones = require('./inputs/zones.json');

let data = {zones: zones, frames: frames};

let tourIds = Object.keys(frames['finalTours']);
let shuffledIds = d3.shuffle([...tourIds]);
let colorTours = d3.scaleOrdinal()
                   .domain(shuffledIds)
                   .range(d3.schemePaired);

function getRgbFromStr(strRgb) {
  var color = d3.color(strRgb);
  return [color.r, color.g, color.b]  
}

const ambientLight = new AmbientLight({
  color: [255, 255, 255],
  intensity: 1.0
});

const pointLight = new PointLight({
  color: [255, 255, 255],
  intensity: 2.0,
  position: [-74.05, 40.7, 8000]
});

const lightingEffect = new LightingEffect({ambientLight, pointLight});

export const INITIAL_VIEW_STATE = {
  longitude: -2.50, //-2.5893897,
  latitude: 51.45,// 51.4516883,
  zoom: 10,
  pitch: 45,
  bearing: 0
};

export class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      frame: this.props.data.frames.finalTours
    };

    this._onNextFrame = this._onNextFrame.bind(this);
  }
  
  _onNextFrame() {
    if (i == frameIds.length-1) {
      i=0
    } else {
      i+=1
    }
    this.setState({frame: this.props.data.frames[frameIds[i]]})    
  }

  _renderLayers() {
    
    const {zones = this.props.data.zones} = this.props;

    return [
      new PathLayer({
        id: 'paths',
        data: this.state.frame,
        widthScale: 100,
        widthMinPixels: 0,
        getPath: d => d.Path,
        getColor: d => getRgbFromStr(colorTours(d.Tourid)),
        getWidth: d => d.Timesused,
        pickable: true,
        autoHighlight: true,
        highlightColor: [0, 255, 255],
        onClick: (info, event) => console.log('Tourid:', info.object.Tourid),
        transitions: {
          getPath: { duration: 500,
                     easing: d3.easeCubicInOut
                   },
         getWidth: { duration: 500,
                     easing: d3.easeCubicInOut
                   },
          getColor: { duration: 500,
                      easing: d3.easeCubicInOut
                    }
          }
      }),

      new GeoJsonLayer({
        id: 'boundaries',
        data: zones,
        stroked: true,
        filled: true,
        pickable: true,
        extruded: false,
        opacity: 0.05,
        autoHighlight: false,
        highlightColor: [0, 255, 255],
        getLineColor: [0, 255, 255],
        getLineWidth: 20,
        onClick: (info, event) => console.log('lsoa:', info.object.properties.lsoa11cd),
      })
    ];
  }
  
  render() {
    const {viewState, controller = true, baseMap = true} = this.props;

    return (
      <div>
        <div>
          <DeckGL
            layers={this._renderLayers()}
            effects={[lightingEffect]}
            initialViewState={INITIAL_VIEW_STATE}
            viewState={viewState}
            controller={controller}
          >
            {baseMap && (
              <StaticMap
                reuseMaps
                mapStyle="mapbox://styles/mapbox/light-v10"
                preventStyleDiffing={true}
                mapboxApiAccessToken={MAPBOX_TOKEN}
              />
            )}
            {this._renderTooltip}        
          </DeckGL>
        </div>
      
        <div className='control-panel'>
            <button
              className='bnt-nextFrame'       
              onClick={this._onNextFrame}> Next
            </button>
          </div>
      </div>            
    );
  }
}

export function renderToDOM(container) {
  render(<App data={data} />, container);
}
