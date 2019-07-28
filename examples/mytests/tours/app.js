/* global window */
import React, {Component} from 'react';
import {render} from 'react-dom';
import {StaticMap} from 'react-map-gl';
import {AmbientLight, PointLight, DirectionalLight, LightingEffect} from '@deck.gl/core';
import DeckGL from '@deck.gl/react';
import {GeoJsonLayer} from 'deck.gl';
import {TripsLayer} from '@deck.gl/geo-layers';
import Typography from '@material-ui/core/Typography';
import {GradientDefs, AreaSeries  } from 'react-vis';
import Slider from '@material-ui/core/Slider';
import {withStyles} from '@material-ui/core/styles';
import {XYPlot, XAxis, YAxis, HorizontalGridLines, LineSeries} from 'react-vis';
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
//MapboxAccess.ClearCache() 
// Set your mapbox token here
const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFyaXNiYWwiLCJhIjoiY2pzbmR0cTU1MGI4NjQzbGl5eTBhZmZrZCJ9.XN4kLWt5YzqmGQYVpFFqKw";

let sampleSizeFile = 1;
let variable = 0;
let pause = true;
let show = true;
let animationSpeed = 100;
let animationSpeed2 = 100;
let prevSimTime = Date.now() / 1000;
let toursData = require(`./inputs/tours_${sampleSizeFile}pct.json`);
let zonesData = require('./inputs/zones.json');

let tourIds = Object.keys(toursData);
let shuffledIds = d3.shuffle([...tourIds]);

let colorTours = d3.scaleOrdinal()
                   .domain(shuffledIds)
                   .range(d3.schemePaired);

let data = {zones: zonesData, tours: toursData};

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

function getRgbFromStr(strRgb) {
  var color = d3.color(strRgb);
  return [color.r, color.g, color.b]  
}
  
function filterToursBySource(tours, zone, prop='Sources') {
  let filtered = Array();
  const filterZone = zone["properties"]["lsoa11cd"];
  filtered = tours.filter(x => x[prop][0] === filterZone);
  return filtered
}

function filterIncompleteTours(tours, currentTime) {  
  for (const tour of tours) {
    tour['Completed'] = false;
    if (tour.Timestamps[tour.Timestamps.length-1] < currentTime) {
      tour['Completed'] = true;
    }
  }
  return tours
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
      simTime: 0,
      animationSpeed: 100,
      trailLength: 100,
      tours: this.props.data.tours,
      sampleSize: 1,
      isHovering: false,
      selectedZone: null
    };

    this._onHover = this._onHover.bind(this);
    this._onSelectObject = this._onSelectObject.bind(this);
    this._onTimerChange = this._onTimerChange.bind(this);
    this._onAnimationSpeedChange = this._onAnimationSpeedChange.bind(this);
    this._onTrailLengthChange = this._onTrailLengthChange.bind(this);
    this._onSampleSizeChange = this._onSampleSizeChange.bind(this);
    
    this._onRestart = this._onRestart.bind(this);
    this._onPause = this._onPause.bind(this);
    this.handleMouseHover = this.handleMouseHover.bind(this);
    this._filterTours = this._filterTours.bind(this);
    this._showhide = this._showhide.bind(this);
  }

  componentDidMount() {
    this._animate();
  }

  componentWillUnmount() {
    if (this._animationFrame) {
      window.cancelAnimationFrame(this._animationFrame);
    }
  }

  handleMouseHover(object) {
    this.setState(this.toggleHoverState);
     variable = object.index;
  }

  toggleHoverState(state) {
    return {
      isHovering: !state.isHovering,
    };
  }

  _onHover({x, y, object}) {
    this.setState({x, y, hoveredObject: object});
  }

  _onSelectObject(object) {
    
    this.setState({selectedZone: null})

    if (object.layer) {
      if (object.layer.id == 'boundaries') {
        this.setState({selectedZone: object.object});
        this._filterTours();
      } else if (object.layer.id == 'tours') {
        this.setState({tours: [object.object]});
      }
    } else {
      this._filterTours();
    }
  }

  _showhide(){
    show = !show;
    return(show)
  }

  _onTimerChange(evnt, newSimTime) {
    this.setState({simTime: newSimTime})
  };

  _onAnimationSpeedChange(evnt, newAnimationSpeed){
    this.setState({animationSpeed: newAnimationSpeed})
    animationSpeed2 = newAnimationSpeed;
  };

  _onTrailLengthChange(evnt, newTrailLength) {    
    this.setState({trailLength: newTrailLength})
  };

  _onSampleSizeChange(evnt, newSampleSize) {
    this.setState({sampleSize: newSampleSize/100})
    this._filterTours()
  };

  _animate() {
    const timestamp = Date.now() / 1000;
    this.setState({ 
      simTime: this.state.simTime + (timestamp - prevSimTime) * this.state.animationSpeed
    });
    prevSimTime = Date.now() / 1000;
    this._animationFrame = window.requestAnimationFrame(this._animate.bind(this));
  }

  _filterTours(singleTourSelected=false) {
    const {allTours = this.props.data.tours} = this.props;
    const sampleSize = this.state.sampleSize;

    if (singleTourSelected) {
      return
    }

    let filteredTours = allTours;
    let incompleteTours;
    let sourceTours;    

    incompleteTours = filterIncompleteTours(filteredTours, this.state.simTime);
    
    if (sampleSize < 1) {
      const n = parseInt(filteredTours.length * sampleSize);
      filteredTours = filteredTours.sort(() => 0.5 - Math.random()).slice(0, n);
    }

    if (!this.state.selectedZone) {
      sourceTours = filteredTours;
    } else {
      sourceTours = filterToursBySource(filteredTours, this.state.selectedZone, 'Sources')
    }
    
    filteredTours = incompleteTours.filter(x => sourceTours.includes(x));
    this.setState({ tours: filteredTours });
  }

  _onPause() {
    if (pause) {
      animationSpeed = 0;
      pause = false;
      this.setState({animationSpeed: 0});
    } else {
      pause = true;   
      this.setState({animationSpeed: animationSpeed2});
      animationSpeed = animationSpeed2;
    }
  };

_onRestart(evnt){
  window.location.reload(false);
};

  _renderLayers() {
    
    const {zones = this.props.data.zones} = this.props;

    return [
      new TripsLayer({
        id: 'tours',
        data: this.state.tours,
        getPath: d => d.Segments,
        getTimestamps: d => d.Timestamps,
        getColor: d => getRgbFromStr(colorTours(d.Tourid)),
        billboard: true,
        widthMinPixels: 2,
        rounded: false,
        trailLength: this.state.trailLength,
        currentTime: this.state.simTime,
        pickable: true,
        autoHighlight: true,
        highlightColor: [0, 255, 255],
        onClick: this._onSelectObject
      }),
      new GeoJsonLayer({
        id: 'boundaries',
        data: zones,
        stroked: true,
        filled: true,
        pickable: true,
        extruded: false,
        opacity: 0.05,
        onClick: this._onSelectObject,
        onHover: this.handleMouseHover,
        autoHighlight: true,
        highlightColor: [0, 255, 255]
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
            onClick={(object) => { this._onSelectObject(object)}}
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
        
      <div className="graph">
        <div
          onMouseEnter={this.handleMouseHover}
          onMouseLeave={this.handleMouseHover}
        >         
        </div>
        {this.state.isHovering &&
       <div> 
        <XYPlot width={300} height={300}>
          <GradientDefs>
           <linearGradient id="CoolGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity={0.8}/>
              <stop offset="100%" stopColor="red" stopOpacity={0.7} />
            </linearGradient>
          </GradientDefs>
          <LineSeries
            data={[
              {x: 1, y: 4},
              {x: 2, y: 7},
              {x: 3, y: variable},
              {x: 4, y: 10},
              {x: 5, y: 13},
              {x: 6, y: 15}
            ]}/>
        </XYPlot>
        </div>}
     </div>
 
    <button className={show ? 'hidden' : 'btn_showhide'}        
        onClick={this._showhide}>Show Menu</button> 

      <div className={show ? 'control-panel' : 'hidden'}>
        <div className='heading'>Bristol City:</div>
         <div>{secondsToHms(Math.floor(this.state.simTime))}</div>
         <div>
          <Typography id="simTime-slider" gutterBottom></Typography>
            <MySlider aria-label="Simulation Time"
              value={this.state.simTime}
              min={0}
              max={86400}
              marks={marks['simTime']}
              onChange={this._onTimerChange}
            />
          </div>

        <div>AnimationSpeed</div>
        <span className="example"></span>
        <div>
          <Typography id="animationSpeed-slider" gutterBottom></Typography>
            <MySlider aria-labelledby="Animation Speed"
              value={Math.round(this.state.animationSpeed, 0)}
              min={0}
              max={3600}
              step = {20}
              valueLabelDisplay="on"
              marks={marks['animationSpeed']}
              onChange={this._onAnimationSpeedChange}
           />
          </div>     

        <div>Trail length</div>
          <span className="example"></span>
        <div>

        <Typography id="trailLength-slider" gutterBottom></Typography>
          <MySlider aria-labelledby="Trail length"
            value={this.state.trailLength}
            valueLabelDisplay="on"
            min={0}
            max={86400}
            step = {20}
            marks={marks['trailLength']}
            onChange={this._onTrailLengthChange}
          />
        </div>

        <Typography id="sampleSize-slider" gutterBottom></Typography>
          <MySlider aria-labelledby="Sample Size"
            value={parseInt(this.state.sampleSize*100)}
            valueLabelDisplay="on"
            min={0}
            max={100}
            step = {1}
            onChangeCommitted={this._onSampleSizeChange}
          />
        </div>
      
      <button
        className="bnt-pause"       
        onClick={this._onPause}>Pause / Play
      </button>

      <button
        className="btn-restart"        
        onClick={this._onRestart}>Restart Script
      </button>

      <button className="btn_hide"        
        onClick={this._showhide}>Hide Menu
      </button>

    </div>
    );
  }
}

export function renderToDOM(container) {
  render(<App data={data} 
          />, container)
}
