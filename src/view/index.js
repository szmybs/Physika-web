import 'bootstrap/dist/css/bootstrap.custom.min.css';
import 'react-bootstrap';
import React, {Component} from 'react';
import ReactDOM, { render } from 'react-dom';
import 'normalize.css';
import GeometryRenderer from "paraviewweb/src/React/Renderers/GeometryRenderer";
import GeometryDataModel from "paraviewweb/src/IO/Core/GeometryDataModel";
import VTKGeometryDataModel from "paraviewweb/src/IO/Core/VTKGeometryDataModel";
import VTKGeometryBuilder from "paraviewweb/src/Rendering/Geometry/VTKGeometryBuilder";
import LookupTableManager from "paraviewweb/src/Common/Core/LookupTableManager";
import PipelineState from "paraviewweb/src/Common/State/PipelineState";
import QueryDataModel from "paraviewweb/src/IO/Core/QueryDataModel";
import ImageRenderer from "paraviewweb/src/React/Renderers/ImageRenderer";

//
import vtkFullScreenRenderWindow from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow';
import vtkOBJReader from 'vtk.js/Sources/IO/Misc/OBJReader';
import vtkActor from "vtk.js/Sources/Rendering/Core/Actor";
import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper';
import file from "paraviewweb/src/IO/Girder/CoreEndpoints/file";

// require('bootstrap/dist/css/bootstrap.custom.min.css');
// var React = require('react');
// var Component = React.Component;
// var render = require('react-dom');

class LeftNav extends Component {
    render() {
        return <nav className="navbar navbar-light align-items-start sidebar sidebar-dark accordion p-0"
                    style={{backgroundColor: "rgb(77, 114, 223)"}}>
            <div className="container-fluid d-flex flex-column p-0">
                <a className="navbar-brand d-flex justify-content-center align-items-center m-0" href="#">
                    <div className="sidebar-brand-icon rotate-n-15"></div>
                    <div className="sidebar-brand-text mx-3"><span>Physika-web</span></div>
                </a>
                <hr className="sidebar-divider my-0"/>
                <ul className="nav navbar-nav text-light" id="accordionSidebar">
                    <li className="nav-item" role="presentation"><a className="nav-link active" href="index.html"><i
                        className="fas fa-tachometer-alt"></i><span>Dashboard</span></a></li>
                    <li className="nav-item" role="presentation"><a className="nav-link" href="profile.html"><i
                        className="fas fa-user"></i><span>Profile</span></a></li>
                    <li className="nav-item" role="presentation"><a className="nav-link" href="table.html"><i
                        className="fas fa-table"></i><span>Table</span></a></li>
                    <li className="nav-item" role="presentation"><a className="nav-link" href="login.html"><i
                        className="far fa-user-circle"></i><span>Login</span></a></li>
                    <li className="nav-item" role="presentation"><a className="nav-link" href="register.html"><i
                        className="fas fa-user-circle"></i><span>Register</span></a></li>
                </ul>
                <div className="text-center d-none d-md-inline">
                    <button className="btn rounded-circle border-0" id="sidebarToggle" type="button"></button>
                </div>
            </div>
        </nav>;
    }
}
// //
class GeoViewer extends Component{
    render() {
        return <div id="content">
            <div className="container-fluid p-0" id={"geoViewer"}>

            </div>
        </div>;
    }
}

/**
 * 加载模型响应事件
 * @param event
 * @param fullScreenRenderer
 */
function input_geo_file_handle(event, fullScreenRenderer) {
    event.preventDefault();
    const geo_file = event.target.files;

    if (geo_file.length == 1) {
        const ext = geo_file[0].name.split('.').slice(-1)[0];
        console.log('loading geometry file successfully, is name '+geo_file[0].name+' and ext is '+ext+'.');
        load(fullScreenRenderer, {file: geo_file[0], ext});
    }
}

/**
 * 加载显示几何体
 * @param options
 */
function load(fullScreenRenderer, options) {
    const renderer = fullScreenRenderer.getRenderer();
    const renderWindow = fullScreenRenderer.getRenderWindow();
    // 加载obj
    if (options.file && options.ext === 'obj') {
        console.log('loading obj... '+options.file.name);
        const reader = new FileReader();
        reader.onload = function (event) {
            const objReader = vtkOBJReader.newInstance();
            objReader.parseAsText(reader.result);
            const nbOutputs = objReader.getNumberOfOutputPorts();
            console.log('nbOutputs is '+nbOutputs);
            for (let idx = 0; idx < nbOutputs; idx++) {
                const source = objReader.getOutputData(idx);
                const mapper = vtkMapper.newInstance();
                const actor = vtkActor.newInstance();
                actor.setMapper(mapper);
                mapper.setInputData(source);
                renderer.addActor(actor);
            }
            console.log('rendering geo...'+options.file.name)
            renderer.resetCamera();
            renderWindow.render();
        };
        reader.readAsText(options.file);
    }
}

/**
 * 首页初始化
 */
function init() {
    window.onload = function() {
        //首页左边布局
        let container = document.getElementById("wrapper");
        render(<LeftNav />, container);
        //首页右边布局
        let viewer = document.createElement("div");
        viewer.id = "content-wrapper";
        viewer.setAttribute("class", "d-flex flex-column")
        container.appendChild(viewer);
        render(<GeoViewer />, viewer);

        let geoViewer = document.getElementById("geoViewer");
        const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
            background: [0, 0, 0],
            rootContainer: geoViewer,
            containerStyle: { height: '100%', width: '100%', position: 'absolute' },
        });
        // const renderer = fullScreenRenderer.getRenderer();
        // const renderWindow = fullScreenRenderer.getRenderWindow();

        // const objReader = vtkOBJReader.newInstance();
        //
        // objReader.setUrl('/static/geo/mujia.obj').then(() => {
        //     console.log(objReader.getNumberOfOutputPorts());
        //
        //     const source = objReader.getOutputData(0);
        //     const mapper = vtkMapper.newInstance();
        //     const actor = vtkActor.newInstance();
        //
        //     actor.setMapper(mapper);
        //     mapper.setInputData(source);
        //     renderer.addActor(actor);
        //
        //     renderer.resetCamera();
        //     renderWindow.render();
        // });

        let sq_btn = document.getElementById('sidebarToggle');
        sq_btn.innerHTML = `<input type="file" accept=".zip,.obj" style="display: none;"/>`;
        let input_geo_file = sq_btn.querySelector('input');
        input_geo_file.addEventListener('change', function (event) {
            if (!event)
                event = window.event;
            input_geo_file_handle(event, fullScreenRenderer)
        });
        sq_btn.addEventListener('click', (e) => input_geo_file.click());

        // objReader.readAsText('/static/geo/mujia.obj');
        // fileReader.onload = function(event) {
        //     console.log('this is onload event');
        // };
        // fileReader.readAsText('/static/geo/mujia.obj');
    }
}



export {init}
















//
// document.body.id = "page-top";
// document.body.appendChild(container);
// // const con = new ReactContainer();
//
//
// class HelloMessage extends Component {
//     render() {
//         return <div>Hello~ {this.props.name}</div>;
//     }
// }
// const div = React.createElement('h1');

// render(
//     <div className="todoListMain">
//         <div className="header">
//             <form> <input placeholder="enter task"> </input>
//                 <button type="submit">add</button>
//             </form>
//         </div>
//     </div>, container
// );

//
// con.setContainer(HelloMessage);
// con.render();

// 加载组件到 DOM 元素 mountNode <HelloMessage name="John" />
// render(div, container);