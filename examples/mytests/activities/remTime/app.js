/* global window */
import React, {Component} from 'react';
import {render} from 'react-dom';
import {StaticMap} from 'react-map-gl';
import {PhongMaterial} from '@luma.gl/core';
import {AmbientLight, PointLight, LightingEffect} from '@deck.gl/core';
import DeckGL from '@deck.gl/react';
import {GeoJsonLayer} from 'deck.gl';
import Slider from '@material-ui/lab/Slider';
import './style.css';

// Set your mapbox token here
const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFyaXNiYWwiLCJhIjoiY2pzbmR0cTU1MGI4NjQzbGl5eTBhZmZrZCJ9.XN4kLWt5YzqmGQYVpFFqKw";

let sampleSize = 1;
let actType = 'Work';
let animationSpeed = 1000 // unit time per second

let simTime = 0;
let anchorTime = Date.now() / 1000;

let actHrsData = require(`./inputs/activity_remTime_${sampleSize}pct.json`);
let zonesData = require('./inputs/zones.json');
let customScale = [-10, 20];

var colorsActs = d3.scaleSequential()
                   .domain((customScale))
                   .interpolator(d3.interpolateOranges);

let data = {zonesData: zonesData, actHrs: actHrsData};

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
      time: 0,
      actHrsTime: 0
    };

    this._renderTooltip = this._renderTooltip.bind(this);
    this._onHover = this._onHover.bind(this);
    this._onTimerChange = this._onTimerChange.bind(this);
  }

  _onHover({x, y, object}) {
    this.setState({x, y, hoveredObject: object});
  }

  _renderTooltip() {
    const {x, y, hoveredObject} = this.state;
    return (
      hoveredObject && (
        <div className="tooltip" style={{top: y, left: x}}>
          <div>
            <b>ActCnt</b>
          </div>
          <div>{_.get(this.props.data.actHrs,`${this.state.actHrsTime}.${actType}.${hoveredObject.properties.lsoa11cd}`, 0)}</div>
        </div>
      )
    );
  }

  componentDidMount() {
    this._animate();
  }

  componentWillUnmount() {
    if (this._animationFrame) {
      window.cancelAnimationFrame(this._animationFrame);
    }
  }

  _onTimerChange(evnt, newSimTime) {
    anchorTime = Date.now() / 1000;
    simTime = newSimTime
  };

  _animate() {
    const timestamp = Date.now() / 1000;
    this.setState({ 
      time: simTime + (timestamp - anchorTime) * this.props.animationSpeed
    }, () => this._updateActHrsTime(this.props.data.actHrs, this.state.time));
    
    this._animationFrame = window.requestAnimationFrame(this._animate.bind(this));
  }
    
  _updateActHrsTime(actsHrs, curTime) {
    // Update the index of the actHrs
    for (const updTime of Object.keys(actsHrs)) {
      if (updTime > curTime) {
        this.setState({actHrsTime: updTime});
        return;
    }
  }
}
  _renderLayers() {
    const {zones = this.props.data.zonesData,
           actHrs = this.props.data.actHrs,
           actType = this.props.actType
          } = this.props;
    
    return [
      new GeoJsonLayer({
        id: 'boundaries',
        data: zones,
        stroked: true,
        filled: true,
        pickable: true,
        extruded: true,
        getElevation: f => _.get(actHrs, `${this.state.actHrsTime}.${actType}.${f.properties.lsoa11cd}`, 0),
        elevationScale: 0.1,
        getFillColor: [255, 255, 255],
        opacity: 1,
        onHover: this._onHover,
        autoHighlight: true,
        highlightColor: [0, 255, 255],
        updateTriggers: {
          getElevation: this.state.time
        }
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
        
        <div className='timer'>
            ({this.state.time})
        </div>

        <div className='time-slider'>
          <Slider
            value={this.state.time}
            min={0}
            max={86400}
            onChange={this._onTimerChange}
          />
        </div>
      </div>
    );
  }
}

export function renderToDOM(container) {
  render(<App actType={actType} 
              data={data} 
              animationSpeed={animationSpeed}/>,
              container);
}
