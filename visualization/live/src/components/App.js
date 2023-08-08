import { useEffect, useState, useRef, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import '../styles/App.css';
import { TextField, InputAdornment, Button, Divider, Link } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SquareIcon from '@mui/icons-material/Square';

function App({socket}) {
    const [nodes, setNodes] = useState({});
    const [links, setLinks] = useState({});

    const [hoverNode, setHoverNode] = useState(null);
    const [highlightNodes, setHighlightNodes] = useState(new Set());
    const [highlightLinks, setHighlightLinks] = useState(new Set());

    const [selectedNode, setSelectedNode] = useState(null);
    const [selectedNodes, setSelectedNodes] = useState(new Set());
    const [selectedLinks, setSelectedLinks] = useState(new Set());
    const [selectedDescActive, setSelectedDescActive] = useState(false);
    const [currTimeout, setCurrTimeout] = useState(null);

    const [highlighted, setHighlighted] = useState(false);

    const [windowSize, setWindowSize] = useState([window.innerWidth, window.innerHeight]);

    const [interestID, setInterestID] = useState('');
    const [searchString, setSearchString] = useState('');
    const [searchSubmitted, setSearchSubmitted] = useState(false);

    const fgRef = useRef();
    const maxNodes = 250;
    const animationTime = 2000;

    const nodeGroupNames = {
        1: 'Post',
        2: 'Person',
        3: 'Highlighted/Selected',
        4: 'Neighbouring Node'
    }

    const nodeColorScheme = {
        1: '#FFC516',
        2: '#6E0097',
        3: '#4ed5ed',
        4: '#a5ed4e'
    };

    const linkColorScheme = {
        'has root': '#FFC516',
        'has parent': '#E30024',
        'liked': '#6E0097',
        'followed': '#FF0097',
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
            if (!highlightLinks.size && !hoverNode && !selectedNode) {
                setHighlighted(false);
            }
        } else {
            if (highlightLinks.size || hoverNode || selectedNode) {
                setHighlighted(true);
            }
        }
    }, [highlighted, highlightLinks, hoverNode, selectedNode]);

    const clear = useCallback(() => {
        setNodes({});
        setLinks({});

        setHighlighted(false);

        setSelectedNode(null);
        setSelectedNodes(new Set());
        setSelectedLinks(new Set());

        clearTimeout(currTimeout);
        setCurrTimeout(null);
        setSelectedDescActive(false);

        setHoverNode(null);
        setHighlightNodes(new Set());
        setHighlightLinks(new Set());

        fgRef.current.cameraPosition({x: 500, y: 500, z: 500}, null, animationTime);
    }, [currTimeout]);

    const updateSelected = useCallback(() => {
        setSelectedNodes(selectedNodes);
        setSelectedLinks(selectedLinks);

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
        if (node.x === 0 && node.y === 0 && node.z === 0) {
            fgRef.current.cameraPosition({x: 250, y: 250, z: 250}, node, animationTime);
        } else {
            const distance = 500;
            const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
            fgRef.current.cameraPosition({x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio}, node, animationTime);
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
    }, [fgRef, links, selectedNodes, selectedLinks, updateSelected, clearSelected]);

    const updateHighlight = () => {
        setHighlightNodes(highlightNodes);
        setHighlightLinks(highlightLinks);

        setNodes(previous => {
            return {
                ...previous
            };
        });
    };

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

        setHoverNode(node || null);
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
        clear();

        socket.emit('interest', searchString);

        setInterestID(searchString);
        setSearchSubmitted(true);
    }, [searchString, socket, clear]);

    useEffect(() => {
        const onDelete = msg => {
            if (highlighted) {
                return;
            }

            let nodeExists = nodes[msg.uri] !== undefined;

            if (nodeExists) {
                setNodes(previous => {
                    let cpy = {...previous};
                    delete cpy[nodes[msg.uri]];

                    return {
                        ...cpy
                    };
                });

                setLinks(previous => {
                    let cpy = {...previous};
                    Object.keys(previous).forEach(key => {
                        let splitRelationship = key.split(' ');
                        let firstNode = splitRelationship[0];
                        let secondNode = splitRelationship[2];
                        
                        if (firstNode.startsWith(msg.uri) || secondNode.startsWith(msg.uri)) {
                            delete cpy[key];
                        }
                    });

                    return {
                        ...cpy
                    };
                });
            }
        }

        const onCreate = msg => {
            if (highlighted || Object.keys(nodes).length >= maxNodes) {
                return;
            }

            if (msg.type === 'person') {
                setNodes(previous => ({
                    ...previous,
                    [msg.did]: {
                        id: msg.did, group: 2
                    }
                }));
            } else if (msg.type === 'post') {
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

            if (msg.type === 'root') {
                let rootExists = nodes[msg.target] !== undefined;
                let nodeExists = nodes[msg.source] !== undefined;

                if ((!rootExists || !nodeExists) && Object.keys(nodes).length >= maxNodes) {
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
                    [msg.source + ' hasRoot ' + msg.target]: {
                        source: msg.source, target: msg.target, value: 'has root'
                    }
                }));
            } else if (msg.type === 'parent') {
                let parentExists = nodes[msg.target] !== undefined;
                let nodeExists = nodes[msg.source] !== undefined;

                if ((!parentExists || !nodeExists) && Object.keys(nodes).length >= maxNodes) {
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
                    [msg.source + ' hasParent ' + msg.target]: {
                        source: msg.source, target: msg.target, value: 'has parent'
                    }
                }));
            } else if (msg.type === 'follow') {
                let p1Exists = nodes[msg.source] !== undefined;
                let p2Exists = nodes[msg.target] !== undefined;

                if ((!p1Exists || !p2Exists) && Object.keys(nodes).length >= maxNodes) {
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
                    [msg.source + ' followed ' + msg.target]: {
                        source: msg.source, target: msg.target, value: 'followed'
                    }
                }));
            } else if (msg.type === 'like') {
                let personExists = nodes[msg.source] !== undefined;
                let postExists = nodes[msg.target] !== undefined;
                
                if ((!personExists || !postExists) && Object.keys(nodes).length >= maxNodes) {
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
                    [msg.source + ' liked ' + msg.target]: {
                        source: msg.source, target: msg.target, value: 'liked'
                    }
                }));
            } else if (msg.type === 'author_of') {
                let personExists = nodes[msg.source] !== undefined;
                let postExists = nodes[msg.target] !== undefined;
                
                if ((!personExists || !postExists) && Object.keys(nodes).length >= maxNodes) {
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
                    [msg.source + ' authorOf ' + msg.target]: {
                        source: msg.source, target: msg.target, value: 'is author of'
                    }
                }));
            } else if (msg.type === 'repost_of') {
                let repostExists = nodes[msg.source] !== undefined;
                let originalPostExists = nodes[msg.target] !== undefined;

                if ((!repostExists || !originalPostExists) && Object.keys(nodes).length >= maxNodes) {
                    return;
                }

                if (create) {
                    if (!repostExists) {
                        setNodes(previous => ({
                            ...previous,
                            [msg.source]: {
                                id: msg.source, group: 1
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

                setLinks(previous => ({
                    ...previous,
                    [msg.source + ' isRepostOf ' + msg.target]: {
                        source: msg.source, target: msg.target, value: 'is repost of'
                    }
                }));
            }
        }
        
        const onInterest = msg => {
            clear();

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
        }

        const eventName = `initial ${interestID}`

        socket.on('create', onCreate);
        socket.on('merge', onMerge);
        socket.on('delete', onDelete);
        socket.on(eventName, onInterest);

        return () => {
            socket.off('create', onCreate);
            socket.off('merge', onMerge);
            socket.off('delete', onDelete);
            socket.off(eventName, onInterest);
        };
    }, [nodes, links, highlighted, interestID, socket, clear]);

    return (
        <>
            <div className='searchbarContainer'>
                <TextField 
                    variant='outlined'
                    color='warning'
                    size='small'

                    label='Subscribe with user ID'
                    placeholder='did:plc:123qwerty'
                    value={searchString}

                    InputProps={{
                        startAdornment: (
                            <InputAdornment position='start'>
                                <SearchIcon />
                            </InputAdornment>
                        ),
                    }}

                    sx={{
                        width: '600px',
                        fontSize: '17.5px'
                    }}

                    onChange={(e) => setSearchString(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit(e)}
                />
                <Button 
                    variant='contained'
                    color='warning'

                    onClick={(e) => {
                        e.preventDefault();
                        setSearchString('');
                        setInterestID('');
                        setSearchSubmitted(false);
                        socket.emit('interest', '');
                        clear();
                    }}
                >
                    Clear
                </Button>
                <Button
                    variant='contained'
                    color='secondary'

                    onClick={handleSearchSubmit}
                >
                    Subscribe
                </Button>
            </div>
            {searchSubmitted && Object.keys(nodes).length === 0 && 
            <div className='noNodesWarning'>
                Zero nodes found for subscribed user ID.
                Please wait a bit, enter a different ID or clear the current one.
            </div>}
            <div className='legend'>
                <div className='infoTitle'>
                    Node types
                </div>
                <Divider/>
                {Object.keys(nodeColorScheme).map(key => {
                    return (
                        <div className='legendItem'>
                            <SquareIcon sx={{color: nodeColorScheme[key]}}/>
                            <div>
                                {nodeGroupNames[key]}
                            </div>
                        </div>
                    )
                })}
            </div>
            {selectedDescActive && selectedNode &&
            <div className='nodeInfo'>
                <div className='infoTitle'>
                    {
                        selectedNode.id.startsWith('did') ? 
                            "Person" : "Post"
                    }
                    <div className='exit' onClick={clearSelected}/>
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
            <ForceGraph3D
                graphData={{nodes: Object.values(nodes), links: Object.values(links)}}

                ref={fgRef}
                backgroundColor='#71797E'
                showNavInfo={false}

                width={windowSize[0]}
                height={windowSize[1]}

                nodeLabel={node => nodeGroupNames[node.group]}
                nodeRelSize={10}
                nodeColor={node => {
                    if (hoverNode === node || selectedNode === node) {
                        return nodeColorScheme[3]
                    }
                    if (highlightNodes.has(node) || selectedNodes.has(node)) {
                        return nodeColorScheme[4]
                    }
                    return nodeColorScheme[node.group]
                }}
                nodeOpacity={1}

                linkLabel='value'
                linkWidth={link => highlightLinks.has(link) || selectedLinks.has(link) ? 5 : 1}
                linkCurvature={0.25}
                linkColor={link => linkColorScheme[link.value]}

                linkDirectionalArrowLength={link => highlightLinks.has(link) || selectedLinks.has(link) ? 7.5 : 2.5}
                linkDirectionalArrowRelPos={0.5}

                linkDirectionalParticles={link => highlightLinks.has(link) || selectedLinks.has(link) ? 1 : 0}
                linkDirectionalParticleWidth={5}
                linkDirectionalParticleSpeed={0.025}

                onNodeClick={handleClick}
                onNodeHover={handleNodeHover}
                onLinkHover={handleLinkHover}

                forceEngine='d3'
                d3AlphaDecay={highlighted ? 1 : 0}
                d3VelocityDecay={0.75}
            />
        </>
    );
};

export default App;