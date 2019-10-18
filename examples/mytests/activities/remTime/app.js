/* global window */
import React, {Component} from 'react';
import DeckGL from '@deck.gl/react';
import {render} from 'react-dom';
import {StaticMap} from 'react-map-gl';
import {AmbientLight, PointLight, LightingEffect} from '@deck.gl/core';
import {GeoJsonLayer} from 'deck.gl';
import Typography from '@material-ui/core/Typography';
import Slider from '@material-ui/core/Slider';
import {withStyles} from '@material-ui/core/styles';

import './style.css';

const marks = {'animationSpeed': [{value: 0,},{value: 3600/4,},{value: 3600/2,},{value: (3600/2)+(3600/4),},{value: 3600,}],
               'simTime': [{value: 0,},{value: (86400/4),},{value: (86400/2),},{value: (86400/2)+(86400/4),},{value: 86400,}],
               'trailLength': [{value: 0,},{value: (86400/4),},{value: (86400/2),},{value: (86400/2)+(86400/4),},{value: 86400,}]}

const myBoxShadow = '0 3px 1px rgba(0,0,0,0.1),0 4px 8px rgba(0,0,0,0.13),0 0 0 1px rgba(0,0,0,0.02)';
const MySlider = withStyles({ root: { color: '#3880ff', height: 2, padding: '5px 0',},
                               thumb: { height: 28,width: 28, backgroundColor: '#fff',
                               boxShadow: myBoxShadow, marginTop: -14, marginLeft: -14,
                               '&:focus,&:hover,&$active': { boxShadow: '0 3px 1px rgba(0,0,0,0.1),0 4px 8px rgba(0,0,0,0.3),0 0 0 1px rgba(0,0,0,0.02)',
                                // Reset on touch devices, it doesn't add specificity
                               '@media (hover: none)': { boxShadow: myBoxShadow, }, }, },active: {},
                               valueLabel: {left: 'calc(-50% + 11px)', top: -22,'& *': { background: 'transparent', color: '#fff', },},
                               track: {height: 2,},rail: { height: 2, opacity: 0.5,
                               backgroundColor: '#fff', }, mark: { backgroundColor: '#fff', height: 8, width: 1, marginTop: -3,},
                               markActive: { backgroundColor: 'currentColor',},})(Slider);

// Set your mapbox token here
const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFyaXNiYWwiLCJhIjoiY2pzbmR0cTU1MGI4NjQzbGl5eTBhZmZrZCJ9.XN4kLWt5YzqmGQYVpFFqKw";

const sampleSize = 10;
const actTypes = ['Home', 'Work', 'Other'];
const actTypeIdx = 2;
const actType = actTypes[actTypeIdx];

let animationSpeed = 1000 // unit time per second
let simTime = 0;
let anchorTime = Date.now() / 1000;

let actRemTimeData = require(`./inputs/activity_remTime_${sampleSize}pct.json`);
let zonesData = require('./inputs/zones.json');

let data = {zonesData: zonesData, actRemTimes: actRemTimeData};

let colorAct = d3.schemeCategory10;

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

function getRgbFromStr(strRgb) {
  var color = d3.color(strRgb);
  return [color.r, color.g, color.b]  
}

function secondsToHms(d) {
  d = Number(d);
  let h = Math.floor(d / 3600);
  let m = Math.floor(d % 3600 / 60);
  //let s = Math.floor(d % 3600 % 60);
  if (h < 24) {
    return  "Time: " + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') 
  } else {
    return 'Simulation finished'
  }    
}

export class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      time: 0,
      actRemSimTime: 0
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
          <div>{_.get(this.props.data.actRemTimes,`${this.state.actRemSimTime}.${actType}.${hoveredObject.properties.lsoa11cd}`, 0)}</div>
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
    }, () => this._updateActRemSimTime(this.props.data.actRemTimes, this.state.time));
    
    this._animationFrame = window.requestAnimationFrame(this._animate.bind(this));
  }
    
  _updateActRemSimTime(actRemSimTimes, curTime) {
    // Update the index of the actHrs
    for (const updTime of Object.keys(actRemSimTimes)) {
      if (updTime > curTime) {
        this.setState({actRemSimTime: updTime});
        return;
    }
  }
}
  _renderLayers() {
    const {zones = this.props.data.zonesData,
           actRemTimes = this.props.data.actRemTimes,
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
        getElevation: f => _.get(actRemTimes, `${this.state.actRemSimTime}.${actType}.${f.properties.lsoa11cd}`, 0),
        elevationScale: 0.001,
        getFillColor: getRgbFromStr(colorAct[actTypeIdx]),
        opacity: 0.7,
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
            initialViewState={INITIAL_VIEW_STATE}
            viewState={viewState}
            controller={controller}
          >
            {baseMap && (
              <StaticMap
                reuseMaps
                mapStyle="mapbox://styles/mapbox/light-v10"
                //streets-v9 dark-v9  light-v10
                preventStyleDiffing={true}
                mapboxApiAccessToken={MAPBOX_TOKEN}
              />
            )}
            {this._renderTooltip}        
          </DeckGL>
        </div>
      
        <div className='control-panel'>
          <div className='heading'>Bristol City:</div>
          <div>{secondsToHms(Math.floor(this.state.time))}</div>
          <div>
              <Typography id="simTime-slider" gutterBottom></Typography>
                <MySlider aria-label="Simulation Time"
                  value={this.state.time}
                  min={0}
                  max={86400}
                  marks={marks['simTime']}
                  onChange={this._onTimerChange}
                />
          </div>
        </div>
        
        <button
          className="bnt-pause"       
          onClick={this._onPause}>Pause / Play
        </button>

        <button
          className="btn-restart"        
          onClick={this._onRestart}>Restart Script
        </button>
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
