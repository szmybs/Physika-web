import React from 'react';
import { Tree, Button, Divider, Descriptions, Collapse} from 'antd';
const { TreeNode } = Tree;
const { Panel } = Collapse;
//antd样式
import 'antd/dist/antd.css';
//渲染窗口
import vtkFullScreenRenderWindow from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow';
//面片拾取
import { physikaLoadConfig } from '../../IO/LoadConfig'
import { physikaUploadConfig } from '../../IO/UploadConfig'
import { PhysikaTreeNodeAttrModal } from '../TreeNodeAttrModal'
import { physikaInitObj } from '../../IO/InitObj';
import { getOrientationMarkerWidget } from '../Widget/OrientationMarkerWidget';
import { parseSimulationResult,checkUploadConfig} from '../../Common'

import WebworkerPromise from 'webworker-promise';
import WSWorker from '../../Worker/ws.worker';

const simType = 1;

class ClothSimulation extends React.Component {
    constructor(props) {
        super(props);
        this.state = {

            data: [],
            treeNodeAttr: {},
            treeNodeText: "",
            treeNodeKey: -1,

            description: [],

            isTreeNodeAttrModalShow: false,
            uploadDisabled: true,
        };
    }

    componentDidMount() {
        //---------初始化渲染窗口
        this.fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
            background: [0.75, 0.76, 0.79],
            rootContainer: geoViewer,
            containerStyle: { height: 'inherit', width: 'inherit' }
        });
        this.renderer = this.fullScreenRenderer.getRenderer();
        this.renderWindow = this.fullScreenRenderer.getRenderWindow();
        this.orientationMarkerWidget = getOrientationMarkerWidget(this.renderWindow);
        //明确一个前提：
        //如果当前帧场景中包含不止一个obj，则这些obj应写在同一个文件中
        //curScene中保存了当前帧中所包含的obj
        //curScene={name:{source, mapper, actor},...}
        this.curScene = {};
        this.fileName = '';
        this.frameSum = 0;
        //worker创建及WebSocket初始化
        this.wsWorker = new WebworkerPromise(new WSWorker());
        this.wsWorker.postMessage({ init: true });
    }

    componentWillUnmount() {
        console.log('子组件将卸载');
        //直接卸载geoViewer中的canvas！！
        let renderWindowDOM = document.getElementById("geoViewer");
        renderWindowDOM.innerHTML = ``;
        //关闭WebSocket
        this.wsWorker.postMessage({ close: true });
        this.wsWorker.terminate();
    }

    clean = () => {
        Object.keys(this.curScene).forEach(key => {
            this.renderer.removeActor(this.curScene[key].actor);
        });
        this.curScene = {};
        this.renderer.resetCamera();
        this.renderWindow.render();

        this.setState({
            description: []
        });
    }

    load = () => {
        physikaLoadConfig(simType)
            .then(res => {
                console.log("成功获取初始化配置");
                this.setState({
                    data: res,
                    uploadDisabled: false
                });
            })
            .catch(err => {
                console.log("Error loading: ", err);
            });
    }

    //更新场景
    updateScene = (newScene) => {
        //移除旧场景actor
        Object.keys(this.curScene).forEach(key => {
            this.renderer.removeActor(this.curScene[key].actor);
        });
        this.curScene = newScene;
        //添加新场景actor
        Object.keys(this.curScene).forEach(key => {
            this.renderer.addActor(this.curScene[key].actor);
        });
        this.renderer.resetCamera();
        this.renderWindow.render();
    }

    /*
    //改变actor的可见性
    changeVisible = (item) => {
        const actor = this.curScene[item._attributes.name].actor;
        const visibility = actor.getVisibility();
        actor.setVisibility(!visibility);
        //因为actor可见性的变化不会触发组件的render，
        //所以这里强制触发render，使得BiShow控件变为BiHide控件
        this.forceUpdate();
        this.renderWindow.render();
    }
    */

    //递归渲染每个树节点（这里必须用map遍历！可能因为需要返回的数组？）
    renderTreeNodes = (data) => data.map((item, index) => {
        item.title = (
            <div>
                <Button type="text" size="small" onClick={() => this.showTreeNodeAttrModal(item)}>{item._attributes.name}</Button>
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



    upload = () => {
        if(!checkUploadConfig(this.state.data)){
            return;
        }
        this.clean();
        this.setState({
            uploadDisabled: true,
        }, () => {
            const extraInfo={
                userID:window.localStorage.userID,
                uploadDate:Date.now(),
                simType:simType,
            }
            physikaUploadConfig(this.state.data, extraInfo)
                .then(res => {
                    console.log("成功上传配置并获取到仿真结果配置");
                    const resultInfo = parseSimulationResult(res);
                    this.fileName = resultInfo.fileName;
                    this.frameSum = resultInfo.frameSum;
                    this.setState({
                        description: resultInfo.description,
                    });
                    if (this.frameSum > 0) {
                        return this.wsWorker.postMessage({
                            data: { fileName: this.fileName + '.obj' }
                        });
                    }
                    else {
                        return Promise.reject('模拟帧数不大于0！');
                    }
                })
                .then(res => {
                    //注意后缀！
                    return physikaInitObj(res, 'zip');
                })
                .then(res => {
                    this.updateScene(res);
                    //显示方向标记部件
                    this.orientationMarkerWidget.setEnabled(true);
                    this.setState({
                        uploadDisabled: false,
                    });
                })
                .catch(err => {
                    console.log("Error uploading: ", err);
                })
        });
    }

    renderDescriptions = () => this.state.description.map((item, index) => {
        return <Descriptions.Item label={item.name} key={index}>{item.content}</Descriptions.Item>
    })

    render() {
        console.log("tree:", this.state.data);
        return (
            <div>
                <Divider>单张图像构建三维云</Divider>
                <Collapse defaultActiveKey={['1']}>
                    <Panel header="仿真初始化" key="1">
                        <Button type="primary" size={'small'} block onClick={this.load}>加载场景</Button>
                        <Tree style={{ overflowX: 'auto', width: '200px' }}>
                            {this.renderTreeNodes(this.state.data)}
                        </Tree>
                        <br />
                        <Button type="primary" size={'small'} block onClick={this.upload} disabled={this.state.uploadDisabled}>开始仿真</Button>
                    </Panel>
                    <Panel header="仿真结果信息" key="2">
                        <Descriptions column={1} layout={'horizontal'}>
                            {this.renderDescriptions()}
                        </Descriptions>
                    </Panel>
                    <Panel header="仿真展示控制" key="3">
                    </Panel>
                </Collapse>
                <div>
                    <PhysikaTreeNodeAttrModal
                        treeNodeAttr={this.state.treeNodeAttr}
                        treeNodeText={this.state.treeNodeText}
                        visible={this.state.isTreeNodeAttrModalShow}
                        hideModal={this.hideTreeNodeAttrModal}
                        changeData={(obj) => this.changeData(obj)}
                    ></PhysikaTreeNodeAttrModal>
                </div>
            </div>
        )
    }
}

//react模块名字首字母必须大写！
export {
    ClothSimulation as PhysikaClothSimulation
};
