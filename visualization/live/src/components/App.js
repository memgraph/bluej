import { useEffect, useState, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import ForceGraph3D from 'react-force-graph-3d';
import '../styles/App.css';
import { TextField, InputAdornment, Button, Divider, Link } from '@mui/material';
import { Select, MenuItem, Checkbox } from '@mui/material';
import { styled } from '@mui/system';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import ModeEditIcon from '@mui/icons-material/ModeEdit';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import memgraphLogo from '../assets/images/memgraph.png'; 
import blueskyLogo from '../assets/images/bluesky.png' ;

const CustomTextField = styled(TextField)(({ theme }) => ({
    '& .MuiOutlinedInput-root': {
        backgroundColor: '#ffffff',
        borderRadius: '30px 0 0 30px',
        boxShadow: '0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)',
        '& fieldset': {
            borderColor: '#0066FF',
        },
        '&:hover fieldset': {
            borderColor: '#0085FF',
            borderWidth: '2px'
        },
        '&.Mui-focused fieldset': {
            borderColor: '#00C2FF',
        },
    },
}));

function App({socket}) {
    const [windowSize, setWindowSize] = useState([window.innerWidth, window.innerHeight]);
    
    const [nodes, setNodes] = useState({});
    const [links, setLinks] = useState({});
    const [maxNodes, setMaxNodes] = useState(250);

    const [highlightNode, setHighlightNode] = useState(null);
    const [highlightNodes, setHighlightNodes] = useState(new Set());
    const [highlightLinks, setHighlightLinks] = useState(new Set());

    const [selectedNode, setSelectedNode] = useState(null);
    const [selectedNodes, setSelectedNodes] = useState(new Set());
    const [selectedLinks, setSelectedLinks] = useState(new Set());
    const [selectedDescActive, setSelectedDescActive] = useState(false);
    const [currTimeout, setCurrTimeout] = useState(null);

    const [interestHandle, setInterestHandle] = useState('');
    const [searchString, setSearchString] = useState('');
    
    const [highlighted, setHighlighted] = useState(false);
    const [subscribed, setSubscribed] = useState(false);

    const [animation, setAnimation] = useState(true);
    const [coloring, setColoring] = useState(true);
    const [is3D, setIs3D] = useState(true);

    const ref3D = useRef();
    const ref2D = useRef();
    const animationTime = 2000;

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [loadingScreen, setLoadingScreen] = useState(true);

    useEffect(() => {
        setTimeout(() => {
            setLoadingScreen(false);
        }, 4000);
    }, []);

    const nodeGroupNames = {
        1: 'Post',
        2: 'Person',
        3: 'Highlighted/Selected',
        4: 'Neighbouring Node'
    }

    const nodeColorScheme = {
        1: '#474747',
        2: '#0066FF',
        3: '#00C2FF',
        4: '#A9A9A9'
    };

    const linkColorScheme = {
        'has root': '#0066FF',
        'has parent': '#0066FF',
        'liked': '#0066FF',
        'followed': '#0066FF',
        'is author of': '#FFFFFF',
        'is repost of': '#FFFFFF'
    };

    useEffect(() => {
        const handleWindowResize = () => {
            setWindowSize([window.innerWidth, window.innerHeight]);
        };
      
        window.addEventListener('resize', handleWindowResize);
        
        return () => {
            window.removeEventListener('resize', handleWindowResize);
        };
    }, []);

    useEffect(() => {
        if (highlighted) {
            if (!highlightLinks.size && !highlightNode && !selectedNode) {
                setHighlighted(false);
            }
        } else {
            if (highlightLinks.size || highlightNode || selectedNode) {
                setHighlighted(true);
            }
        }
    }, [highlighted, highlightLinks, highlightNode, selectedNode]);

    const clear = useCallback((resetCamera = true) => {
        setNodes({});
        setLinks({});

        setHighlighted(false);

        clearTimeout(currTimeout);
        setCurrTimeout(null);
        setSelectedDescActive(false);

        setSelectedNode(null);
        setSelectedNodes(new Set());
        setSelectedLinks(new Set());

        setHighlightNode(null);
        setHighlightNodes(new Set());
        setHighlightLinks(new Set());

        if (resetCamera) {
            if (is3D) {
                ref3D.current.cameraPosition({x: 500, y: 500, z: 500}, null, animationTime);
            } else {
                ref2D.current.centerAt(0, 0, animationTime);
                ref2D.current.zoom(1, animationTime);
            }
        }
    }, [is3D, ref3D, ref2D, currTimeout]);

    const updateSelected = useCallback(() => {
        setSelectedNodes(new Set(selectedNodes));
        setSelectedLinks(new Set(selectedLinks));

        setNodes(previous => {
            return {
                ...previous
            };
        });
    }, [selectedNodes, selectedLinks]);

    const clearSelected = useCallback(() => {
        clearTimeout(currTimeout);
        setCurrTimeout(null);
        setSelectedDescActive(false);

        setSelectedNode(null);
        selectedNodes.clear();
        selectedLinks.clear();
        updateSelected();
    }, [selectedNodes, selectedLinks, currTimeout, updateSelected]);

    const handleClick = useCallback(node => {
        if (is3D) {
            if (node.x === 0 && node.y === 0 && node.z === 0) {
                ref3D.current.cameraPosition({x: 250, y: 250, z: 250}, node, animationTime);
            } else {
                const distance = 500;
                const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
                ref3D.current.cameraPosition({x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio}, node, animationTime);
            }
        } else {
            ref2D.current.centerAt(node.x, node.y, animationTime);
            ref2D.current.zoom(2.5, animationTime);
        }

        clearSelected();

        Object.keys(links).forEach(key => {
            let splitRelationship = key.split(' ');
            let firstNode = splitRelationship[0];
            let secondNode = splitRelationship[2];
            
            if (firstNode.startsWith(node.id) || secondNode.startsWith(node.id)) {
                let link = links[key];

                selectedLinks.add(link);
                selectedNodes.add(link.source);
                selectedNodes.add(link.target);
            }
        });

        setSelectedNode(node);
        updateSelected();

        setCurrTimeout(setTimeout(() => {
            setSelectedDescActive(true);
        }, animationTime));
    }, [is3D, ref3D, ref2D, links, selectedNodes, selectedLinks, updateSelected, clearSelected]);

    const updateHighlight = useCallback(() => {
        setHighlightNodes(new Set(highlightNodes));
        setHighlightLinks(new Set(highlightLinks));

        setNodes(previous => {
            return {
                ...previous
            };
        });
    }, [highlightNodes, highlightLinks]);

    const clearHighlight = useCallback(() => {
        setHighlightNode(null);
        highlightNodes.clear();
        highlightLinks.clear();
        updateHighlight();
    }, [highlightNodes, highlightLinks, updateHighlight]);

    const handleNodeHover = node => {
        highlightNodes.clear();
        highlightLinks.clear();

        if (node) {
            highlightNodes.add(node);

            Object.keys(links).forEach(key => {
                let splitRelationship = key.split(' ');
                let firstNode = splitRelationship[0];
                let secondNode = splitRelationship[2];
                
                if (firstNode.startsWith(node.id) || secondNode.startsWith(node.id)) {
                    let link = links[key];

                    highlightLinks.add(link);
                    highlightNodes.add(link.source);
                    highlightNodes.add(link.target);
                }
            });
        }

        setHighlightNode(node || null);
        updateHighlight();
    };

    const handleLinkHover = link => {
        highlightNodes.clear();
        highlightLinks.clear();

        if (link) {
            highlightLinks.add(link);
            highlightNodes.add(link.source);
            highlightNodes.add(link.target);
        }

        updateHighlight();
    };

    const handleSearchSubmit = useCallback(e => {
        e.preventDefault();

        setInterestHandle(searchString);
        socket.emit('interest', searchString);
        setSubscribed(false);
        
        clear();
    }, [searchString, socket, clear]);

    const handleMaxNodeChange = useCallback((max) => {
        if (max < Object.keys(nodes).length) {
            clear(false);
        }

        setMaxNodes(max);
    }, [nodes, clear])

    const handleAnimationChanged = useCallback((disabled) => {
        if (disabled) {
            clearSelected();
            clearHighlight();
        }

        setAnimation(!disabled);
    }, [clearSelected, clearHighlight]);

    const handle3DChanged = useCallback((disabled) => {
        clearSelected();
        clearHighlight();

        setIs3D(!disabled);
    }, [clearSelected, clearHighlight]);

    useEffect(() => {
        const onDelete = msg => {
            let nodeKey = msg?.did || msg.uri;
            let nodeExists = nodes[nodeKey] !== undefined;

            if (!nodeExists) {
                return;
            }

            let node = nodes[nodeKey];
            let wasCenter = false;

            setNodes(previous => {
                let cpy = {...previous};
                delete cpy[nodeKey];

                return {
                    ...cpy
                };
            });

            if (highlightNodes.has(node)) {
                highlightNodes.delete(node);
                setHighlightNodes(new Set(highlightNodes));
            }

            if (selectedNodes.has(node)) {
                selectedNodes.delete(node);
                setSelectedNodes(new Set(selectedNodes));
            }

            if (highlightNode === node) {
                setHighlightNode(null);
                setHighlightNodes(new Set());
                setHighlightLinks(new Set());

                wasCenter = true;
            }

            if (selectedNode === node) {
                setSelectedNode(null);
                setSelectedNodes(new Set());
                setSelectedLinks(new Set());
        
                clearTimeout(currTimeout);
                setCurrTimeout(null);
                setSelectedDescActive(false);

                wasCenter = true;
            }

            setLinks(previous => {
                let cpy = {...previous};
                Object.keys(previous).forEach(key => {
                    let splitRelationship = key.split(' ');
                    let firstNode = splitRelationship[0];
                    let secondNode = splitRelationship[2];
                    
                    if (firstNode.startsWith(nodeKey) || secondNode.startsWith(nodeKey)) {
                        let link = links[key];
                        let source_node = nodes[firstNode];
                        let target_node = nodes[secondNode];
                        
                        delete cpy[key];

                        if (highlightLinks.has(link)) {
                            highlightLinks.delete(link);
                            setHighlightLinks(new Set(highlightLinks));

                            if (source_node !== highlightNode) {
                                highlightNodes.delete(source_node);
                                setHighlightNodes(new Set(highlightNodes));
                            }
            
                            if (target_node !== highlightNode) {
                                highlightNodes.delete(target_node);
                                setHighlightNodes(new Set(highlightNodes));
                            }
                        }

                        if (selectedLinks.has(link)) {
                            selectedLinks.delete(link);
                            setSelectedLinks(new Set(selectedLinks));

                            if (source_node !== selectedNode) {
                                selectedNodes.delete(source_node);
                                setSelectedNodes(new Set(selectedNodes));
                            }
                            
                            if (target_node !== selectedNode) {
                                selectedNodes.delete(target_node);
                                setSelectedNodes(new Set(selectedNodes));
                            }
                        }
                    }
                });

                return {
                    ...cpy
                };
            });

            if (wasCenter) {
                toast.warn('The node you were focused on has been deleted.');
            }
        }

        const onCreate = msg => {
            if (highlighted || Object.keys(nodes).length >= maxNodes) {
                return;
            }

            if (msg.type === 'Person') {
                setNodes(previous => ({
                    ...previous,
                    [msg.did]: {
                        id: msg.did, group: 2
                    }
                }));
            } else if (msg.type === 'Post') {
                setNodes(previous => ({
                    ...previous,
                    [msg.uri]: {
                        id: msg.uri, group: 1, author: msg?.author, text: msg?.text, repostUri: msg?.repostUri
                    }
                }));
            }
        }

        const onMerge = (msg, create = true) => {
            if (highlighted) {
                return;
            }

            if (msg.type === 'ROOT') {
                let rootExists = nodes[msg.target] !== undefined;
                let nodeExists = nodes[msg.source] !== undefined;

                let nonExistingCount = rootExists + nodeExists;

                if ((!rootExists || !nodeExists) && Object.keys(nodes).length > maxNodes - nonExistingCount) {
                    return;
                }

                if (create) {
                    if (!rootExists) {
                        setNodes(previous => ({
                            ...previous,
                            [msg.target]: {
                                id: msg.target, group: 1
                            }
                        }));
                    }
    
                    if (!nodeExists) {
                        setNodes(previous => ({
                            ...previous,
                            [msg.source]: {
                                id: msg.source, group: 1
                            }
                        }));
                    }
                }

                setLinks(previous => ({
                    ...previous,
                    [msg.source + ' ' + msg.type + ' ' + msg.target]: {
                        source: msg.source, target: msg.target, value: 'has root'
                    }
                }));
            } else if (msg.type === 'PARENT') {
                let parentExists = nodes[msg.target] !== undefined;
                let nodeExists = nodes[msg.source] !== undefined;

                let nonExistingCount = parentExists + nodeExists;

                if ((!parentExists || !nodeExists) && Object.keys(nodes).length > maxNodes - nonExistingCount) {
                    return;
                }

                if (create) {
                    if (!parentExists) {
                        setNodes(previous => ({
                            ...previous,
                            [msg.target]: {
                                id: msg.target, group: 1
                            }
                        }));
                    }
                    
                    if (!nodeExists) {
                        setNodes(previous => ({
                            ...previous,
                            [msg.source]: {
                                id: msg.source, group: 1
                            }
                        }));
                    }
                }

                setLinks(previous => ({
                    ...previous,
                    [msg.source + ' ' + msg.type + ' ' + msg.target]: {
                        source: msg.source, target: msg.target, value: 'has parent'
                    }
                }));
            } else if (msg.type === 'FOLLOW') {
                let p1Exists = nodes[msg.source] !== undefined;
                let p2Exists = nodes[msg.target] !== undefined;

                let nonExistingCount = p1Exists + p2Exists;

                if ((!p1Exists || !p2Exists) && Object.keys(nodes).length > maxNodes - nonExistingCount) {
                    return;
                }

                if (create) {
                    if (!p1Exists) {
                        setNodes(previous => ({
                            ...previous,
                            [msg.source]: {
                                id: msg.source, group: 2
                            }
                        }));
                    }
    
                    if (!p2Exists) {
                        setNodes(previous => ({
                            ...previous,
                            [msg.target]: {
                                id: msg.target, group: 2
                            }
                        }));
                    }
                }

                setLinks(previous => ({
                    ...previous,
                    [msg.source + ' ' + msg.type + ' ' + msg.target]: {
                        source: msg.source, target: msg.target, value: 'followed'
                    }
                }));
            } else if (msg.type === 'LIKE') {
                let personExists = nodes[msg.source] !== undefined;
                let postExists = nodes[msg.target] !== undefined;

                let nonExistingCount = personExists + postExists;
                
                if ((!personExists || !postExists) && Object.keys(nodes).length > maxNodes - nonExistingCount) {
                    return;
                }

                if (create) {
                    if (!personExists) {
                        setNodes(previous => ({
                            ...previous,
                            [msg.source]: {
                                id: msg.source, group: 2
                            }
                        }));
                    }
    
                    if (!postExists) {
                        setNodes(previous => ({
                            ...previous,
                            [msg.target]: {
                                id: msg.target, group: 1
                            }
                        }));
                    }
                }

                setLinks(previous => ({
                    ...previous,
                    [msg.source + ' ' + msg.type + ' ' + msg.target]: {
                        source: msg.source, target: msg.target, value: 'liked'
                    }
                }));
            } else if (msg.type === 'AUTHOR_OF') {
                let personExists = nodes[msg.source] !== undefined;
                let postExists = nodes[msg.target] !== undefined;

                let nonExistingCount = personExists + postExists;
                
                if ((!personExists || !postExists) && Object.keys(nodes).length > maxNodes - nonExistingCount) {
                    return;
                }

                if (create) {
                    if (!personExists) {
                        setNodes(previous => ({
                            ...previous,
                            [msg.source]: {
                                id: msg.source, group: 2
                            }
                        }));
                    }
    
                    if (!postExists) {
                        setNodes(previous => ({
                            ...previous,
                            [msg.target]: {
                                id: msg.target, group: 1
                            }
                        }));
                    }
                }

                setLinks(previous => ({
                    ...previous,
                    [msg.source + ' ' + msg.type + ' ' + msg.target]: {
                        source: msg.source, target: msg.target, value: 'is author of'
                    }
                }));
            } else if (msg.type === 'REPOST_OF') {
                let repostExists = nodes[msg.source] !== undefined;
                let originalPostExists = nodes[msg.target] !== undefined;

                let nonExistingCount = repostExists + originalPostExists;

                if ((!repostExists || !originalPostExists) && Object.keys(nodes).length > maxNodes - nonExistingCount) {
                    return;
                }

                if (create) {
                    if (!repostExists) {
                        setNodes(previous => ({
                            ...previous,
                            [msg.source]: {
                                id: msg.source, group: 1, repostUri: msg.target
                            }
                        }));
                    }
    
                    if (!originalPostExists) {
                        setNodes(previous => ({
                            ...previous,
                            [msg.target]: {
                                id: msg.target, group: 1
                            }
                        }));
                    }
                }

                let repostNode = nodes[msg.source];

                if (repostNode && !repostNode?.repostUri) {
                    repostNode.repostUri = msg.target;
                    setNodes(previous => ({
                        ...previous,
                        [msg.source]: repostNode
                    }));
                }

                setLinks(previous => ({
                    ...previous,
                    [msg.source + ' ' + msg.type + ' ' + msg.target]: {
                        source: msg.source, target: msg.target, value: 'is repost of'
                    }
                }));
            }
        }

        const onDetach = msg => {
            let key = msg.source + ' ' + msg.type + ' ' + msg.target;
            let link = links[key];

            if (!link) {
                return;
            }

            let source_node = nodes[msg.source];
            let target_node = nodes[msg.target];

            if (highlightLinks.has(link)) {
                highlightLinks.delete(link);
                setHighlightLinks(new Set(highlightLinks));

                if (source_node !== highlightNode) {
                    highlightNodes.delete(source_node);
                    setHighlightNodes(new Set(highlightNodes));
                }

                if (target_node !== highlightNode) {
                    highlightNodes.delete(target_node);
                    setHighlightNodes(new Set(highlightNodes));
                }
            }

            if (selectedLinks.has(link)) {
                selectedLinks.delete(link);
                setSelectedLinks(new Set(selectedLinks));

                if (source_node !== selectedNode) {
                    selectedNodes.delete(source_node);
                    setSelectedNodes(new Set(selectedNodes));
                }
                
                if (target_node !== selectedNode) {
                    selectedNodes.delete(target_node);
                    setSelectedNodes(new Set(selectedNodes));
                }
            }

            setLinks(previous => {
                let cpy = {...previous};
                delete cpy[key];

                return {
                    ...cpy
                };
            });
        }
        
        const onInterest = msg => {
            clear(false);

            if (msg.length > 0) {
                let startNode = msg[0];
                onCreate(startNode);
                msg.shift();
    
                msg.forEach(curr_rel => {
                    let node1ID = curr_rel.node1.did;
                    let node2ID = curr_rel.node2.did;
        
                    if (!nodes[node1ID]) {
                        onCreate(curr_rel.node1, false);
                    }
        
                    if (!nodes[node2ID]) {
                        onCreate(curr_rel.node2, false);
                    }
        
                    onMerge(curr_rel.relationship, false);
                });
            }

            if (interestHandle) {
                setSubscribed(true);
            } else {
                setSubscribed(false);
            }
        }

        const eventName = `initial ${interestHandle}`

        socket.on('create', onCreate);
        socket.on('merge', onMerge);
        socket.on('delete', onDelete);
        socket.on('detach', onDetach);
        socket.on(eventName, onInterest);

        return () => {
            socket.off('create', onCreate);
            socket.off('merge', onMerge);
            socket.off('delete', onDelete);
            socket.off('detach', onDetach);
            socket.off(eventName, onInterest);
        };
    }, [nodes, links, maxNodes, highlightNode, highlightNodes, highlightLinks, selectedNode, selectedNodes, selectedLinks, highlighted, currTimeout, interestHandle, socket, clear]);

    const changeDrawerStatus = useCallback(e => {
        setDrawerOpen(!drawerOpen);

    }, [drawerOpen])
    return (
        <>
        <div style={{width: "100%", height: "100%"}}>
            {loadingScreen
            ? <div className='loadingContainer'>
                <div className='logoContainer'>
                    <img src={memgraphLogo} alt='Memgraph logo' style={{width: "45%"}}/>
                    <img src={blueskyLogo} alt="bluesky logo" style={{width: "45%"}}/>
                </div>
                <div className="loader"></div>
            </div>
            : <div style={{width: "100%", height: "100%"}}>
                <ToastContainer 
                    position='top-left'
                    autoClose={7500}
                    hideProgressBar={false}
                    newestOnTop={true}
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme='light'
                />
                <div className='searchContainer'>
                    <CustomTextField
                        variant='outlined'
                        placeholder='Subscribe with user handle'

                        size='small'
                        value={searchString}

                        className='{classes.searchTextField}'

                        InputProps={{
                            startAdornment: (
                                <InputAdornment position='start'>
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                            endAdornment: (
                                <InputAdornment position='end'>
                                    <CloseIcon
                                        className='clearSearchButton'
                                        style={{cursor: 'pointer', transition: 'color 0.3s'}}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setSearchString('');
                                            setInterestHandle('');
                    
                                            socket.emit('interest', '');
                                            setSubscribed(false);
                                            clear();
                                        }}
                                    />
                                </InputAdornment>
                            )
                        }}

                        sx={{
                            width: '50%',
                            fontSize: '17.5px',
                        }}

                        onChange={(e) => setSearchString(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit(e)}
                    />
                    <Button
                        variant='contained'
                        style={{
                            backgroundColor: '#0066FF',
                            borderRadius: '0 30px 30px 0'
                        }}

                        onClick={handleSearchSubmit}
                    >
                        Subscribe
                    </Button>
                </div>
                <div className={`drawerContainer ${drawerOpen ? '' : 'smaller'}`}>
                    <div className={`drawerContent ${drawerOpen ? '' : 'inactive'}`}>
                        <Button
                            variant='contained'
                            style={{
                                marginTop: '15px',
                                backgroundColor: '#0066FF',
                                borderRadius: '10px 0 0 10px',
                            }}
                            startIcon={<MenuIcon style={{width: '35px', height: '35px'}}/>}
                            onClick={changeDrawerStatus}
                        ></Button>
                        <div className='drawerMenu'>
                            <div className='itemTitle'>
                                <SettingsIcon style={{margin: '10px 5px 0 5px'}}/>
                                <p style={{margin: '10px 0 0 0'}}>Settings</p>
                            </div>
                            <div className='itemSettings'>
                                <p className='itemText'>Max node count</p>
                                <Select
                                    value={maxNodes}
                                    size="small"
                                    sx={{
                                        marginRight: '10px'
                                    }}

                                    onChange={(e) => handleMaxNodeChange(e.target.value)}
                                >
                                    <MenuItem value={100}>100</MenuItem>
                                    <MenuItem value={250}>250</MenuItem>
                                    <MenuItem value={500}>500</MenuItem>
                                    <MenuItem value={1000}>1000</MenuItem>
                                    <MenuItem value={2500}>2500</MenuItem>
                                </Select>
                            </div>
                            <div className='itemSettings'>
                                <p className='itemText'>Disable Animations</p>
                                <Checkbox sx={{color: '#0066FF'}} onChange={(e) => handleAnimationChanged(e.target.checked)}/>
                            </div>
                            <div className='itemSettings'>
                                <p className='itemText'>Disable Coloring</p>
                                <Checkbox sx={{color: '#0066FF'}} onChange={(e) => setColoring(!e.target.checked)}/>
                            </div>
                            <div className='itemSettings'>
                                <p className='itemText'>Disable 3D</p>
                                <Checkbox sx={{color: '#0066FF'}} onChange={(e) => handle3DChanged(e.target.checked)}/>
                            </div>
                            <div className='itemTitle'>
                                <ModeEditIcon style={{margin: '10px 5px 0 5px'}}/>
                                <p style={{margin: '10px 0 0 0'}}>Node coloring</p>
                            </div>
                            <div className='itemColoring'>
                                <div className='nodeColor nodePerson'></div>
                                <p style={{margin: '10px 0 10px 0'}}>Person</p>
                            </div>
                            <div className='itemColoring'>
                                <div className='nodeColor nodePost'></div>
                                <p style={{margin: '10px 0 10px 0'}}>Post</p>
                            </div>
                            <div className='itemColoring'>
                                <div className='nodeColor nodeSelected'></div>
                                <p style={{margin: '10px 0 10px 0'}}>Selected</p>
                            </div>
                            <div className='itemColoring'>
                                <div className='nodeColor nodeNeighbouring'></div>
                                <p style={{margin: '10px 0 10px 0'}}>Neighbouring</p>
                            </div>
                            <div className='itemTitle'>
                                <InfoOutlinedIcon style={{margin: '10px 5px 0 5px'}}/>
                                <p style={{margin: '10px 0 0 0'}}>About</p>
                            </div>
                            <div className='item'>
                                <p className='aboutText'>Version 1.0</p>
                            </div>
                        </div>
                    </div>
                </div>
                {subscribed && Object.keys(nodes).length === 0 && 
                <div className='noNodesWarning'>
                    Zero nodes found for subscribed user ID.
                    Please wait a bit, enter a different ID or clear the current one.
                </div>}
                {selectedDescActive && selectedNode &&
                <div className='nodeInfo'>
                    <div className='infoTitle'>
                        {
                            selectedNode.id.startsWith('did') ? 
                                'Person' : 'Post'
                        }
                        <CloseIcon 
                            style={{
                                cursor: 'pointer'
                            }}
                            onClick={clearSelected}/>
                    </div>
                    <Divider/>
                    {
                        selectedNode.id.startsWith('did') ? 
                            <div className='nodeInfoBody'> 
                                <div className='nodeInfoList'>
                                    ID: {selectedNode.id}
                                </div>
                                <Divider/>
                                <Link 
                                    href={`https://bsky.app/profile/${selectedNode.id}`} 
                                    underline='hover'
                                    target='_blank'
                                    color='secondary'
                                    sx={{
                                        alignSelf: 'center',
                                        marginTop: '10px'
                                    }}
                                >
                                    Visit profile
                                </Link>
                            </div> : 
                        selectedNode.text ? 
                            <div className='nodeInfoBody'> 
                                <div className='nodeInfoList'>
                                    ID: {selectedNode.id}
                                    <br/>
                                    Text: {selectedNode.text}
                                </div>
                                <Divider/>
                                <Link 
                                    href={`https://bsky.app/profile/${selectedNode.id.split('//')[1].split('/')[0]}/post/${selectedNode.id.split('//')[1].split('/')[2]}`} 
                                    underline='hover'
                                    target='_blank'
                                    color='secondary'
                                    sx={{
                                        alignSelf: 'center',
                                        marginTop: '10px'
                                    }}
                                >
                                    Visit post
                                </Link>
                            </div> :
                        selectedNode.repostUri ? 
                            <div className='nodeInfoBody'> 
                                <div className='nodeInfoList'>
                                    ID: {selectedNode.id}
                                    <br/>
                                    Original post ID: {selectedNode.repostUri}
                                </div>
                                <Divider/>
                                <Link 
                                    href={`https://bsky.app/profile/${selectedNode.repostUri.split('//')[1].split('/')[0]}/post/${selectedNode.repostUri.split('//')[1].split('/')[2]}`} 
                                    underline='hover'
                                    target='_blank'
                                    color='secondary'
                                    sx={{
                                        alignSelf: 'center',
                                        marginTop: '10px'
                                    }}
                                >
                                    Visit original post
                                </Link>
                            </div> :
                        <div className='nodeInfoBody'> 
                            <div className='nodeInfoList'>
                                ID: {selectedNode.id}
                            </div>
                            <Divider/>
                            <Link 
                                href={`https://bsky.app/profile/${selectedNode.id.split('//')[1].split('/')[0]}/post/${selectedNode.id.split('//')[1].split('/')[2]}`} 
                                underline='hover'
                                target='_blank'
                                color='secondary'
                                sx={{
                                    alignSelf: 'center',
                                    marginTop: '10px'
                                }}
                            >
                                Visit post
                            </Link>
                        </div>
                    }
                </div>}
                {is3D ?
                <ForceGraph3D
                    graphData={{nodes: Object.values(nodes), links: Object.values(links)}}

                    ref={ref3D}
                    backgroundColor='#ffffff'
                    showNavInfo={false}

                    width={windowSize[0]}
                    height={windowSize[1]}

                    nodeLabel={node => nodeGroupNames[node.group]}
                    nodeRelSize={10}
                    nodeColor={node => {
                        if (!coloring) {
                            return '#FFFFFF';
                        }
                        if (highlightNode === node || selectedNode === node) {
                            return nodeColorScheme[3];
                        }
                        if (highlightNodes.has(node) || selectedNodes.has(node)) {
                            return nodeColorScheme[4];
                        }
                        return nodeColorScheme[node.group];
                    }}
                    nodeOpacity={1}

                    linkLabel='value'
                    linkWidth={link => highlightLinks.has(link) || selectedLinks.has(link) ? 5 : 1}
                    linkCurvature={0.25}
                    linkColor={link => {
                        if (!coloring) {
                            return '#FFFFFF';
                        }
                        return linkColorScheme[link.value];
                    }}

                    linkDirectionalArrowLength={link => highlightLinks.has(link) || selectedLinks.has(link) ? 7.5 : 2.5}
                    linkDirectionalArrowRelPos={0.5}

                    linkDirectionalParticles={link => highlightLinks.has(link) || selectedLinks.has(link) ? 1 : 0}
                    linkDirectionalParticleWidth={5}
                    linkDirectionalParticleSpeed={0.025}

                    onNodeClick={animation && handleClick}
                    onNodeHover={animation && handleNodeHover}
                    onLinkHover={animation && handleLinkHover}

                    forceEngine='d3'
                    d3AlphaDecay={highlighted ? 1 : 0}
                    d3VelocityDecay={0.75}
                /> :
                <ForceGraph2D
                    graphData={{nodes: Object.values(nodes), links: Object.values(links)}}

                    ref={ref2D}
                    backgroundColor='#ffffff'

                    width={windowSize[0]}
                    height={windowSize[1]}

                    nodeLabel={node => nodeGroupNames[node.group]}
                    nodeRelSize={10}
                    nodeColor={node => {
                        if (!coloring) {
                            return '#FFFFFF';
                        }
                        if (highlightNode === node || selectedNode === node) {
                            return nodeColorScheme[3];
                        }
                        if (highlightNodes.has(node) || selectedNodes.has(node)) {
                            return nodeColorScheme[4];
                        }
                        return nodeColorScheme[node.group];
                    }}

                    linkLabel='value'
                    linkWidth={link => highlightLinks.has(link) || selectedLinks.has(link) ? 5 : 1}
                    linkCurvature={0.25}
                    linkColor={link => {
                        if (!coloring) {
                            return '#FFFFFF';
                        }
                        return linkColorScheme[link.value];
                    }}

                    linkDirectionalArrowLength={link => highlightLinks.has(link) || selectedLinks.has(link) ? 7.5 : 2.5}
                    linkDirectionalArrowRelPos={0.5}

                    linkDirectionalParticles={link => highlightLinks.has(link) || selectedLinks.has(link) ? 1 : 0}
                    linkDirectionalParticleWidth={5}
                    linkDirectionalParticleSpeed={0.025}

                    onNodeClick={animation ? handleClick : () => {}}
                    onNodeHover={animation ? handleNodeHover : () => {}}
                    onLinkHover={animation ? handleLinkHover : () => {}}

                    d3AlphaDecay={highlighted ? 1 : 0}
                    d3VelocityDecay={0.75}
                />}
            </div>
            }
        </div>
        </>
    );
};

export default App;