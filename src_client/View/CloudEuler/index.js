import 'bootstrap';
import React from 'react';
import { Tree, Button } from 'antd';
import { BiShow, BiHide, BiPointer, BiMinus } from 'react-icons/bi'
const { TreeNode } = Tree;
//antd样式
import 'antd/dist/antd.css';
//渲染窗口
import vtkFullScreenRenderWindow from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow';
//坐标轴
import vtkAxesActor from 'vtk.js/Sources/Rendering/Core/AxesActor';
//旋转控制控件
import vtkOrientationMarkerWidget from 'vtk.js/Sources/Interaction/Widgets/OrientationMarkerWidget';

import vtkVolumeController from 'vtk.js/Sources/Interaction/UI/VolumeController';
//import style from './VolumeViewer.module.css';

import { physikaLoadConfig } from '../../IO/LoadConfig'
import { physikaUploadConfig } from '../../IO/UploadConfig'
import { PhysikaTreeNodeAttrModal } from '../TreeNodeAttrModal'
import { physikaLoadVti } from '../../IO/LoadVti'

function getOrientationMarkerWidget(renderWindow) {
    const axesActor = vtkAxesActor.newInstance();
    const orientationMarkerWidget = vtkOrientationMarkerWidget.newInstance({
        actor: axesActor,
        interactor: renderWindow.getInteractor(),
    });
    orientationMarkerWidget.setViewportCorner(
        vtkOrientationMarkerWidget.Corners.BOTTOM_LEFT
    );
    //控制控件大小
    orientationMarkerWidget.setViewportSize(0.3);
    orientationMarkerWidget.setMinPixelSize(100);
    orientationMarkerWidget.setMaxPixelSize(300);

    return orientationMarkerWidget;
}

class CloudEulerSimulation extends React.Component {
    constructor(props) {
        super(props);
        this.state = {

            data: [],
            isTreeNodeAttrModalShow: false,
            treeNodeAttr: {},
            treeNodeText: "",
            treeNodeKey: -1,
            uploadDisabled: true

        };
    }

    componentDidMount() {
        //---------初始化渲染窗口
        this.fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
            background: [0, 0, 0],
            rootContainer: geoViewer,
            containerStyle: { height: '100%', width: '100%', position: 'absolute' }
        });
        this.renderer = this.fullScreenRenderer.getRenderer();
        this.renderWindow = this.fullScreenRenderer.getRenderWindow();
        //curScene={{source, mapper, actor},...}
        this.curScene = {};
        //frameSeq保存了每帧场景，用于实现动画
        this.frameSeq = [];

        /*
        //添加坐标轴：X：红，Y：黄，Z: 绿
        this.axesActor = vtkAxesActor.newInstance();
        this.renderer.addActor(this.axesActor);
        */
        //--------添加旋转控制控件
        this.orientationMarkerWidget = getOrientationMarkerWidget(this.renderWindow);

    }

    /*
    componentWillUnmount() {
        console.log('子组件将卸载');
    }
    */

    load = () => {
        physikaLoadConfig('fluid')
            .then(res => {
                console.log("成功获取初始化配置");
                this.setState({
                    data: res,
                    uploadDisabled: false
                });
                //除了加载初始化配置文件还需要什么？

            })
            .catch(res => {
                console.log("Error loading: ", err);
            })
    }

    //从配置文件中提取模型的url
    extractURL = (data) => {
        for (const item1 of data[0].children) {
            if (item1.tag === 'SimulationRun') {
                for (const item2 of item1.children) {
                    if (item2.tag == 'Path') {
                        const url = item2._text;
                        const ext = url.substring(url.lastIndexOf('.') + 1);
                        return { fileURL: url, ext: ext };
                    }
                }
            }
        }
        console.log("throw error");
    }

    //递归渲染每个树节点（这里必须用map遍历！因为需要返回数组）
    renderTreeNodes = (data) => data.map((item, index) => {
        item.title = (
            <div>
                {
                    (item.tag === 'Node') &&
                    (this.curScene[item._attributes.name].actor.getVisibility()
                        ? <BiShow type="regular" onClick={() => this.changeVisible(item)}></BiShow>
                        : <BiHide type="regular" onClick={() => this.changeVisible(item)}></BiHide>)
                }
                <Button type="text" size="small" onClick={() => this.showTreeNodeAttrModal(item)}>{item._attributes.name}</Button>
                {
                    (item.tag === 'Node') &&
                    <BiPointer type="regular" onClick={() => this.cellPick(item)}></BiPointer>
                }
            </div>
        );

        if (item.children) {
            return (
                <TreeNode title={item.title} key={item.key} >
                    {this.renderTreeNodes(item.children)}
                </TreeNode>
            );
        }

        return <TreeNode {...item} />;
    });

    showTreeNodeAttrModal = (item) => {
        this.setState({
            isTreeNodeAttrModalShow: true,
            treeNodeAttr: item._attributes,
            treeNodeKey: item.key,
            treeNodeText: item._text
        });
    }

    hideTreeNodeAttrModal = () => {
        this.setState({
            isTreeNodeAttrModalShow: false
        });
    }

    //接收TreeNodeAttrModal返回的结点数据并更新树
    changeData = (obj) => {
        //注意：这里直接改变this.state.data本身不会触发渲染，
        //真正触发渲染的是hideTreeNodeAttrModal()函数的setState！
        //官方并不建议直接修改this.state中的值，因为这样不会触发渲染，
        //但是React的setState本身并不能处理nested object的更新。
        //若该函数不再包含hideTreeNodeAttrModal()函数，则需要另想办法更新this.state.data！
        let eachKey = this.state.treeNodeKey.split('-');
        let count = 0;
        const findTreeNodeKey = (node) => {
            if (count === eachKey.length - 1) {
                //找到treeNodeKey对应树结点，更新数据
                if (obj.hasOwnProperty('_text')) {
                    console.log("obj ", obj);
                    node[eachKey[count]]._text = obj._text;
                }
                //若以后需修改_attributes属性，则在此添加代码
                return;
            }
            findTreeNodeKey(node[eachKey[count++]].children);
        };
        findTreeNodeKey(this.state.data);
        this.hideTreeNodeAttrModal();
    }

    resetScene = (newScene) => {
        //移除旧场景actor
        this.renderer.removeActor(this.curScene.actor);
        this.curScene = newScene;
        console.log(this.curScene);
        //添加新场景actor
        this.renderer.addActor(this.curScene.actor);
        this.renderer.resetCamera();
        this.renderWindow.render();
    }

    upload = () => {
        //第一个参数data，第二个参数仿真类型
        physikaUploadConfig(this.state.data, 'fluid')
            .then(res => {
                console.log("成功上传配置并获取到仿真结果配置");
                console.log(res);
                let options = this.extractURL(res);
                return Promise.all([physikaLoadVti(options), res]);
            })
            .then(res => {
                console.log("成功获取仿真结果模型", res);
                this.frameSeq = res[0];
                this.resetScene(this.frameSeq[0]);
                this.setState({ data: res[1] });
                //显示方向标记部件
                this.orientationMarkerWidget.setEnabled(true);

                
                const controllerWidget = vtkVolumeController.newInstance({
                    size: [400, 150],
                    rescaleColorMap: true,
                });
                const isBackgroundDark = true;
                controllerWidget.setContainer(widget);
                controllerWidget.setupContent(this.renderWindow, this.curScene.actor, isBackgroundDark);
                
            })
            .catch(err => {
                console.log("Error uploading: ", err);
            });
    }

    render() {
        console.log("tree:", this.state.data);
        return (
            <div className="w-100" >
                <div className="card border rounded-0"><span className="text-center m-1">云欧拉仿真</span>
                    <hr className="m-0" />
                    <div className="card-body pt-2">
                        <button className="btn btn-danger btn-sm p-0 btn-block" type="button" onClick={this.load}><span className="glyphicon glyphicon-plus">加载场景</span></button>
                        <div className="pt-2">
                            <Tree >
                                {this.renderTreeNodes(this.state.data)}
                            </Tree>
                        </div>

                        <button className="btn btn-danger btn-sm p-0 btn-block" type="button" onClick={this.upload} disabled={this.state.uploadDisabled}><span className="glyphicon glyphicon-plus">上传</span></button>
                    </div>
                    <div >
                        <PhysikaTreeNodeAttrModal
                            treeNodeAttr={this.state.treeNodeAttr}
                            treeNodeText={this.state.treeNodeText}
                            visible={this.state.isTreeNodeAttrModalShow}
                            hideModal={this.hideTreeNodeAttrModal}
                            changeData={(obj) => this.changeData(obj)}
                        ></PhysikaTreeNodeAttrModal>
                    </div>
                    <div id="widget"></div>
                </div>
            </div>
        );
    }

}

export {
    CloudEulerSimulation as Test
}